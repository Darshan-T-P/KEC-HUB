import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def check_db():
    load_dotenv()
    uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB")
    print(f"DATABASE_URI_SET: {'Yes' if uri else 'No'}")
    print(f"DATABASE_NAME: {db_name}")
    
    client = AsyncIOMotorClient(uri)
    db = client[db_name]
    
    try:
        collections = await db.list_collection_names()
        print(f"Collections Found: {len(collections)}")
        
        results = []
        for coll_name in collections:
            count = await db[coll_name].count_documents({})
            results.append(f" - {coll_name}: {count} docs")
        
        print("\n".join(results))
        
        # Check users specifically
        if "users" in collections:
            print("\nRoles in 'users' collection:")
            pipeline = [{"$group": {"_id": "$role", "count": {"$sum": 1}}}]
            async for res in db["users"].aggregate(pipeline):
                print(f"  Role: {res['_id']}, Count: {res['count']}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())
