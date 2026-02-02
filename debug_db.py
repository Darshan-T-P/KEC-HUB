
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def debug_db():
    load_dotenv()
    uri = os.getenv("MONGODB_URI")
    if not uri:
        print("MONGODB_URI not found")
        return

    client = AsyncIOMotorClient(uri)
    db = client["kec_hub"]
    col = db["sheet1"]
    
    print(f"Checking collection: kec_hub.sheet1")
    count = await col.count_documents({})
    print(f"Total documents: {count}")
    
    if count > 0:
        sample = await col.find_one({})
        print(f"Sample document keys: {list(sample.keys())}")
        print(f"Sample email value: {sample.get('email') or sample.get('Email') or 'N/A'}")
    
    collections = await db.list_collection_names()
    print(f"Available collections in kec_hub: {collections}")

if __name__ == "__main__":
    asyncio.run(debug_db())
