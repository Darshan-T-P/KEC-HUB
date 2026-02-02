
import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

async def debug_event_regs(event_id_str):
    uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB")
    client = motor.motor_asyncio.AsyncIOMotorClient(uri)
    db = client[db_name]
    
    event_id = ObjectId(event_id_str)
    regs = await db['event_registrations'].find({"eventId": event_id}).to_list(100)
    print(f"COUNT: {len(regs)}")
    for r in regs:
        print(f"EMAIL|{r.get('studentEmail')}|ANS|{r.get('answers')}")

if __name__ == "__main__":
    ev_id = "69807e4ca86f95dde62fe304"
    asyncio.run(debug_event_regs(ev_id))
