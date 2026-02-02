import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_email():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URI'))
    db = client.kec_hub
    
    # Search for the email with case-insensitive regex
    email = "gurruprasaathmk.23aid@kongu.edu"
    
    # Try exact match
    result = await db.sheet1.find_one({"Email ID": email})
    print(f"Exact match for '{email}': {result}")
    
    # Try case-insensitive
    result2 = await db.sheet1.find_one({"Email ID": {"$regex": f"^{email}$", "$options": "i"}})
    print(f"\nCase-insensitive match: {result2}")
    
    # Search by partial name
    result3 = await db.sheet1.find_one({"Email ID": {"$regex": "gurruprasaath", "$options": "i"}})
    print(f"\nPartial search 'gurruprasaath': {result3}")
    
    # Check collection stats
    count = await db.sheet1.count_documents({})
    print(f"\nTotal documents in sheet1: {count}")
    
    # Get a few sample emails
    samples = await db.sheet1.find({}, {"Email ID": 1, "Name": 1, "_id": 0}).limit(5).to_list(5)
    print(f"\nSample emails:")
    for s in samples:
        print(f"  - {s}")
    
    client.close()

asyncio.run(check_email())
