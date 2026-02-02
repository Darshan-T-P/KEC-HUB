from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from bson import ObjectId

from motor.motor_asyncio import AsyncIOMotorDatabase


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class OtpRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["otp_codes"]

    async def ensure_indexes(self) -> None:
        # TTL index: expires documents automatically.
        await self.col.create_index("expiresAt", expireAfterSeconds=0)
        await self.col.create_index("email", unique=True)

    async def get(self, email: str) -> Optional[Dict[str, Any]]:
        return await self.col.find_one({"email": email})

    async def upsert(self, doc: Dict[str, Any]) -> None:
        await self.col.update_one({"email": doc["email"]}, {"$set": doc}, upsert=True)

    async def delete(self, email: str) -> None:
        await self.col.delete_one({"email": email})


class VerifiedEmailRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["verified_emails"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index("expiresAt", expireAfterSeconds=0)
        await self.col.create_index("email", unique=True)

    async def mark_verified(self, email: str, ttl_minutes: int = 15) -> None:
        expires_at = utc_now() + timedelta(minutes=ttl_minutes)
        await self.col.update_one(
            {"email": email},
            {"$set": {"email": email, "verifiedAt": utc_now(), "expiresAt": expires_at}},
            upsert=True,
        )

    async def is_verified(self, email: str) -> bool:
        doc = await self.col.find_one({"email": email})
        return doc is not None


class StudentEmailRepository:
    """Repository for checking valid student emails from kec_hub.sheet1 collection"""
    def __init__(self, db: AsyncIOMotorDatabase):
        # db here should be the kec_hub database with sheet1 containing 7888 student emails
        self.col = db["sheet1"]
        self.db = db  # Store reference for debugging
        print(f"[REPO] StudentEmailRepository initialized with database: {db.name}")

    async def ensure_indexes(self) -> None:
        # Create index on Email ID field for faster lookups
        await self.col.create_index("Email ID")

    async def has_data(self) -> bool:
        """Check if the collection has any documents (email validation data loaded)."""
        try:
            count = await self.col.count_documents({}, limit=1)
            print(f"[REPO] has_data() check - Database: {self.db.name}, Collection: sheet1, Count: {count}")
            return count > 0
        except Exception as e:
            print(f"[REPO] has_data() error: {e}")
            return False

    async def is_valid_student_email(self, email: str) -> bool:
        """Check if email exists in the kec_hub.sheet1 student database"""
        try:
            doc = await self.col.find_one({"Email ID": email})
            print(f"[REPO] is_valid_student_email({email}) - Found: {doc is not None}")
            if doc:
                print(f"[REPO] Student record: Name={doc.get('Name')}, Roll No={doc.get('Roll No')}")
            return doc is not None
        except Exception as e:
            print(f"[REPO] is_valid_student_email error: {e}")
            return False
    
    async def get_student_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get student details by email"""
        return await self.col.find_one({"Email ID": email})


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["users"]

    async def ensure_indexes(self) -> None:
        # Backward compatibility: older records may not have a role.
        # Treat missing role as 'student' and migrate so we can use a compound unique index.
        await self.col.update_many({"role": {"$exists": False}}, {"$set": {"role": "student"}})

        # Drop old unique email index if present; it prevents same email across roles.
        try:
            indexes = [idx async for idx in self.col.list_indexes()]
            for idx in indexes:
                if idx.get("name") == "email_1":
                    await self.col.drop_index("email_1")
                    break
        except Exception:
            # Non-fatal: we'll still attempt to create the compound index.
            pass

        await self.col.create_index([("email", 1), ("role", 1)], unique=True)

    def _role_filter(self, email: str, role: str) -> Dict[str, Any]:
        role = (role or "student").strip().lower()
        if role == "student":
            # After migration role should exist, but keep compatibility.
            return {"email": email, "$or": [{"role": "student"}, {"role": {"$exists": False}}]}
        return {"email": email, "role": role}

    async def find_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return await self.col.find_one({"email": email})

    async def find_by_email_and_role(self, email: str, role: str) -> Optional[Dict[str, Any]]:
        return await self.col.find_one(self._role_filter(email, role))

    async def find_public_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        # Exclude sensitive fields
        return await self.col.find_one({"email": email}, {"passwordHash": 0})

    async def find_public_by_email_and_role(self, email: str, role: str) -> Optional[Dict[str, Any]]:
        return await self.col.find_one(self._role_filter(email, role), {"passwordHash": 0})

    async def create(self, user_doc: Dict[str, Any]) -> None:
        await self.col.insert_one(user_doc)

    async def update_profile(self, email: str, role: str, profile_update: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not profile_update:
            return await self.find_public_by_email_and_role(email, role)

        # Store extended fields under a single nested document: profile.*
        set_doc = {f"profile.{k}": v for k, v in profile_update.items()}
        await self.col.update_one(self._role_filter(email, role), {"$set": set_doc})
        return await self.find_public_by_email_and_role(email, role)

    async def update_core_fields(self, email: str, role: str, core_update: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not core_update:
            return await self.find_public_by_email_and_role(email, role)

        await self.col.update_one(self._role_filter(email, role), {"$set": core_update})
        return await self.find_public_by_email_and_role(email, role)


class AlumniPostRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["alumni_posts"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index([("alumniEmail", 1), ("createdAt", -1)])
        await self.col.create_index("createdAt")

    async def create(self, doc: Dict[str, Any]) -> str:
        res = await self.col.insert_one(doc)
        return str(res.inserted_id)

    async def list_all(self, limit: int = 100) -> list[Dict[str, Any]]:
        cur = self.col.find({}, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]

    async def list_by_alumni(self, alumni_email: str, limit: int = 100) -> list[Dict[str, Any]]:
        cur = self.col.find({"alumniEmail": alumni_email}, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]

    async def get_by_id(self, post_id: str) -> Optional[Dict[str, Any]]:
        try:
            oid = ObjectId(post_id)
        except Exception:
            return None
        return await self.col.find_one({"_id": oid})

    async def update_post(self, post_id: str, alumni_email: str, updates: Dict[str, Any]) -> bool:
        try:
            oid = ObjectId(post_id)
        except Exception:
            return False
        res = await self.col.update_one({"_id": oid, "alumniEmail": alumni_email}, {"$set": updates})
        return bool(res.modified_count)


class EventRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["events"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index([("managerEmail", 1), ("createdAt", -1)])
        await self.col.create_index([("startAt", 1)])
        await self.col.create_index([("allowedDepartmentsLower", 1)])

    async def create(self, doc: Dict[str, Any]) -> str:
        res = await self.col.insert_one(doc)
        return str(res.inserted_id)

    async def get_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        try:
            oid = ObjectId(event_id)
        except Exception:
            return None
        return await self.col.find_one({"_id": oid})

    async def list_by_manager(self, manager_email: str, limit: int = 100) -> list[Dict[str, Any]]:
        cur = self.col.find({"managerEmail": manager_email}, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]

    async def list_visible_for_department(self, dept: str, limit: int = 100) -> list[Dict[str, Any]]:
        dept_l = (dept or "").strip().lower()
        q = {
            "$or": [
                {"allowedDepartmentsLower": {"$exists": False}},
                {"allowedDepartmentsLower": {"$size": 0}},
                {"allowedDepartmentsLower": dept_l},
            ]
        }
        cur = self.col.find(q, sort=[("startAt", 1), ("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]

    async def exists_by_title_and_manager(self, title: str, manager_email: str, exclude_id: Optional[str] = None) -> bool:
        query = {"title": title, "managerEmail": manager_email}
        if exclude_id:
            try:
                oid = ObjectId(exclude_id)
                query["_id"] = {"$ne": oid}
            except Exception:
                pass
        doc = await self.col.find_one(query, {"_id": 1})
        return doc is not None

    async def set_poster(self, event_id: str, manager_email: str, poster_meta: Dict[str, Any]) -> bool:
        try:
            oid = ObjectId(event_id)
        except Exception:
            return False
        res = await self.col.update_one({"_id": oid, "managerEmail": manager_email}, {"$set": {"poster": poster_meta}})
        return bool(res.modified_count)

    async def update_event(self, event_id: str, manager_email: str, updates: Dict[str, Any]) -> bool:
        try:
            oid = ObjectId(event_id)
        except Exception:
            return False
        res = await self.col.update_one({"_id": oid, "managerEmail": manager_email}, {"$set": updates})
        return bool(res.modified_count)


class EventRegistrationRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["event_registrations"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index([("eventId", 1), ("createdAt", -1)])
        await self.col.create_index([("studentEmail", 1), ("createdAt", -1)])
        await self.col.create_index([("eventId", 1), ("studentEmail", 1)], unique=True)

    async def exists(self, event_id: ObjectId, student_email: str) -> bool:
        doc = await self.col.find_one({"eventId": event_id, "studentEmail": student_email}, {"_id": 1})
        return doc is not None

    async def create(self, doc: Dict[str, Any]) -> str:
        res = await self.col.insert_one(doc)
        return str(res.inserted_id)

    async def list_by_event(self, event_id: ObjectId, limit: int = 300) -> list[Dict[str, Any]]:
        cur = self.col.find({"eventId": event_id}, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]


class ReferralRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["referrals"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index([("alumniEmail", 1), ("createdAt", -1)])
        await self.col.create_index([("studentEmail", 1), ("createdAt", -1)])
        await self.col.create_index([("status", 1), ("createdAt", -1)])

        # Prevent duplicate requests for the same alumni post.
        # Only applies when postId is present (string). Without this partial filter,
        # Mongo would treat null as a value and block multiple unrelated requests.
        try:
            await self.col.create_index(
                [("studentEmail", 1), ("alumniEmail", 1), ("postId", 1)],
                unique=True,
                partialFilterExpression={"postId": {"$type": "string"}},
                name="uniq_student_alumni_post",
            )
        except Exception as e:
            # If duplicates already exist, Mongo will reject creating the unique index.
            # Don't block app startup; the endpoint-level check still prevents new duplicates.
            print(f"[DB] Warning: could not create uniq_student_alumni_post index: {e}")

    async def create(self, doc: Dict[str, Any]) -> str:
        res = await self.col.insert_one(doc)
        return str(res.inserted_id)

    async def exists_for_student_alumni_post(self, student_email: str, alumni_email: str, post_id: str) -> bool:
        if not post_id:
            return False
        doc = await self.col.find_one({"studentEmail": student_email, "alumniEmail": alumni_email, "postId": post_id}, {"_id": 1})
        return doc is not None

    async def list_for_alumni(self, alumni_email: str, status: Optional[str] = None, limit: int = 100) -> list[Dict[str, Any]]:
        q: Dict[str, Any] = {"alumniEmail": alumni_email}
        if status:
            q["status"] = status
        cur = self.col.find(q, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]

    async def list_for_student(self, student_email: str, limit: int = 100) -> list[Dict[str, Any]]:
        cur = self.col.find({"studentEmail": student_email}, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]

    async def decide(self, req_id: str, alumni_email: str, decision: str, decided_at: datetime, note: Optional[str]) -> Optional[Dict[str, Any]]:
        try:
            oid = ObjectId(req_id)
        except Exception:
            return None

        update = {"status": decision, "decidedAt": decided_at}
        if note is not None:
            update["alumniNote"] = note

        await self.col.update_one({"_id": oid, "alumniEmail": alumni_email}, {"$set": update})
        return await self.col.find_one({"_id": oid})


def _participant_key(email: str, role: str) -> str:
    return f"{(role or '').strip().lower()}:{email.strip().lower()}"


def make_thread_id(a_email: str, a_role: str, b_email: str, b_role: str) -> str:
    a = _participant_key(a_email, a_role)
    b = _participant_key(b_email, b_role)
    return "th_" + "__".join(sorted([a, b]))


class PlacementRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["placement_notices"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index([("staffEmail", 1), ("createdAt", -1)])
        await self.col.create_index([("createdAt", -1)])
        await self.col.create_index([("allowedDepartmentsLower", 1)])
        await self.col.create_index([("minCgpa", 1)])
        await self.col.create_index([("maxArrears", 1)])

    async def create(self, doc: Dict[str, Any]) -> str:
        res = await self.col.insert_one(doc)
        return str(res.inserted_id)

    async def get_by_id(self, notice_id: str) -> Optional[Dict[str, Any]]:
        try:
            oid = ObjectId(notice_id)
        except Exception:
            return None
        return await self.col.find_one({"_id": oid})

    async def list_by_staff(self, staff_email: str, limit: int = 200) -> list[Dict[str, Any]]:
        cur = self.col.find({"staffEmail": staff_email}, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]

    async def list_visible_for_student(
        self,
        student_department: str,
        student_cgpa: Optional[float],
        student_arrears: Optional[int],
        limit: int = 200,
    ) -> list[Dict[str, Any]]:
        dept_l = (student_department or "").strip().lower()

        # Department visibility: allow all when missing/empty; else require membership.
        dept_filter: Dict[str, Any] = {
            "$or": [
                {"allowedDepartmentsLower": {"$exists": False}},
                {"allowedDepartmentsLower": {"$size": 0}},
                {"allowedDepartmentsLower": dept_l},
            ]
        }

        # Eligibility rules. If notice has a constraint and student does not have the field,
        # treat as not eligible (safer).
        cgpa_filter: Dict[str, Any] = {
            "$or": [
                {"minCgpa": {"$exists": False}},
                {"minCgpa": None},
            ]
        }
        if student_cgpa is not None:
            cgpa_filter["$or"].append({"minCgpa": {"$lte": float(student_cgpa)}})

        arrears_filter: Dict[str, Any] = {
            "$or": [
                {"maxArrears": {"$exists": False}},
                {"maxArrears": None},
            ]
        }
        if student_arrears is not None:
            arrears_filter["$or"].append({"maxArrears": {"$gte": int(student_arrears)}})

        q: Dict[str, Any] = {"$and": [dept_filter, cgpa_filter, arrears_filter]}
        cur = self.col.find(q, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]


class ManagementInstructionRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["management_instructions"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index([("staffEmail", 1), ("createdAt", -1)])
        await self.col.create_index([("createdAt", -1)])
        await self.col.create_index([("allowedDepartmentsLower", 1)])

    async def create(self, doc: Dict[str, Any]) -> str:
        res = await self.col.insert_one(doc)
        return str(res.inserted_id)

    async def list_by_staff(self, staff_email: str, limit: int = 200) -> list[Dict[str, Any]]:
        cur = self.col.find({"staffEmail": staff_email}, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]

    async def list_visible_for_department(self, dept: str, limit: int = 200) -> list[Dict[str, Any]]:
        dept_l = (dept or "").strip().lower()
        q: Dict[str, Any] = {
            "$or": [
                {"allowedDepartmentsLower": {"$exists": False}},
                {"allowedDepartmentsLower": {"$size": 0}},
                {"allowedDepartmentsLower": dept_l},
            ]
        }
        cur = self.col.find(q, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]


class ManagementNoteRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["management_notes"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index([("staffEmail", 1), ("createdAt", -1)])
        await self.col.create_index([("createdAt", -1)])
        await self.col.create_index([("allowedDepartmentsLower", 1)])

    async def create(self, doc: Dict[str, Any]) -> str:
        res = await self.col.insert_one(doc)
        return str(res.inserted_id)

    async def list_by_staff(self, staff_email: str, limit: int = 200) -> list[Dict[str, Any]]:
        cur = self.col.find({"staffEmail": staff_email}, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]

    async def list_visible_for_department(self, dept: str, limit: int = 200) -> list[Dict[str, Any]]:
        dept_l = (dept or "").strip().lower()
        q: Dict[str, Any] = {
            "$or": [
                {"allowedDepartmentsLower": {"$exists": False}},
                {"allowedDepartmentsLower": {"$size": 0}},
                {"allowedDepartmentsLower": dept_l},
            ]
        }
        cur = self.col.find(q, sort=[("createdAt", -1)]).limit(int(limit))
        return [d async for d in cur]


class ChatThreadRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["chat_threads"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index([("participants", 1), ("updatedAt", -1)])
        await self.col.create_index("updatedAt")

    async def upsert_on_message(
        self,
        thread_id: str,
        participants: list[str],
        updated_at: datetime,
        last_message: str,
        last_sender: str,
    ) -> None:
        await self.col.update_one(
            {"_id": thread_id},
            {
                "$set": {
                    "participants": participants,
                    "updatedAt": updated_at,
                    "lastMessage": last_message,
                    "lastSender": last_sender,
                }
            },
            upsert=True,
        )

    async def list_for_user(self, email: str, role: str, limit: int = 50) -> list[Dict[str, Any]]:
        key = _participant_key(email, role)
        cur = self.col.find({"participants": key}, sort=[("updatedAt", -1)]).limit(int(limit))
        return [d async for d in cur]


class ChatMessageRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["chat_messages"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index([("threadId", 1), ("createdAt", 1)])
        await self.col.create_index("createdAt")

    async def create(self, doc: Dict[str, Any]) -> str:
        res = await self.col.insert_one(doc)
        return str(res.inserted_id)

    async def list_by_thread(self, thread_id: str, limit: int = 200) -> list[Dict[str, Any]]:
        cur = self.col.find({"threadId": thread_id}, sort=[("createdAt", 1)]).limit(int(limit))
        return [d async for d in cur]


class PlacementExperienceRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["placement_experiences"]

    async def ensure_indexes(self) -> None:
        await self.col.create_index("companyName")
        await self.col.create_index("studentEmail")
        await self.col.create_index([("createdAt", -1)])

    async def create(self, doc: Dict[str, Any]) -> str:
        res = await self.col.insert_one(doc)
        return str(res.inserted_id)

    async def list_by_company(self, company_name: str, limit: int = 100) -> list[Dict[str, Any]]:
        # Case-insensitive search
        import re
        pattern = re.compile(f"^{re.escape(company_name)}$", re.IGNORECASE)
        cur = self.col.find({"companyName": pattern}).sort("createdAt", -1).limit(int(limit))
        return [d async for d in cur]

    async def list_all(self, limit: int = 100) -> list[Dict[str, Any]]:
        cur = self.col.find({}).sort("createdAt", -1).limit(int(limit))
        return [d async for d in cur]

    async def list_by_student(self, student_email: str, limit: int = 50) -> list[Dict[str, Any]]:
        cur = self.col.find({"studentEmail": student_email}).sort("createdAt", -1).limit(int(limit))
        return [d async for d in cur]

