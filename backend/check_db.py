import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_databases():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URI'))
    
    # List all databases
    print("Available databases:")
    dbs = await client.list_database_names()
    for db_name in dbs:
        print(f"  - {db_name}")
    
    # Check both possible database names
    for db_name in ['kec_hub', 'kec_opportunities_hub']:
        print(f"\n=== Checking database: {db_name} ===")
        db = client[db_name]
        
        collections = await db.list_collection_names()
        print(f"Collections: {collections}")
        
        if 'sheet1' in collections:
            count = await db.sheet1.count_documents({})
            print(f"sheet1 document count: {count}")
            
            if count > 0:
                # Get sample
                sample = await db.sheet1.find_one({})
                print(f"Sample document: {sample}")
    
    client.close()

asyncio.run(check_databases())
