import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_user():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URI'))
    
    # Check student email in kec_hub.sheet1
    email = "darshantp.23aim@kongu.edu"
    kec_hub_db = client.kec_hub
    result = await kec_hub_db.sheet1.find_one({"Email ID": email})
    print(f"Email '{email}' in kec_hub.sheet1: {result}")
    
    # Check user in kec_opportunities_hub.users
    opp_hub_db = client.kec_opportunities_hub
    user = await opp_hub_db.users.find_one({"email": email, "role": "event_manager"})
    print(f"\nUser in kec_opportunities_hub.users: {user}")
    
    # Also check kec_hub.users
    user2 = await kec_hub_db.users.find_one({"email": email, "role": "event_manager"})
    print(f"\nUser in kec_hub.users: {user2}")
    
    client.close()

asyncio.run(check_user())
