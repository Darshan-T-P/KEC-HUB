import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_databases():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URI'))
    
    email = "darshantp.23aim@kongu.edu"
    
    print("=" * 60)
    print("CHECKING EMAIL VALIDATION (kec_hub.sheet1)")
    print("=" * 60)
    kec_hub_db = client.kec_hub
    student_record = await kec_hub_db.sheet1.find_one({"Email ID": email})
    if student_record:
        print(f"✓ Email found in kec_hub.sheet1")
        print(f"  Name: {student_record.get('Name')}")
        print(f"  Roll No: {student_record.get('Roll No')}")
    else:
        print(f"✗ Email NOT found in kec_hub.sheet1")
    
    print("\n" + "=" * 60)
    print("CHECKING USER ACCOUNTS (kec_opportunities_hub.users)")
    print("=" * 60)
    opp_hub_db = client.kec_opportunities_hub
    users = await opp_hub_db.users.find({"email": email}).to_list(10)
    if users:
        print(f"✓ Found {len(users)} user(s) in kec_opportunities_hub.users:")
        for user in users:
            print(f"  - Role: {user.get('role')}, Name: {user.get('name')}")
            print(f"    Has password hash: {bool(user.get('passwordHash'))}")
    else:
        print(f"✗ No users found in kec_opportunities_hub.users")
    
    print("\n" + "=" * 60)
    print("CHECKING USER ACCOUNTS (kec_hub.users)")
    print("=" * 60)
    users_kec = await kec_hub_db.users.find({"email": email}).to_list(10)
    if users_kec:
        print(f"✓ Found {len(users_kec)} user(s) in kec_hub.users:")
        for user in users_kec:
            print(f"  - Role: {user.get('role')}, Name: {user.get('name')}")
            print(f"    Has password hash: {bool(user.get('passwordHash'))}")
    else:
        print(f"✗ No users found in kec_hub.users")
    
    client.close()

asyncio.run(check_databases())
