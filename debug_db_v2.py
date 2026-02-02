
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def debug_db():
    load_dotenv()
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["kec_hub"]
    col = db["sheet1"]
    
    docs = await col.find({}).limit(5).to_list(length=5)
    for i, doc in enumerate(docs):
        print(f"Doc {i}: {doc.get('Email ID')}")

if __name__ == "__main__":
    asyncio.run(debug_db())
