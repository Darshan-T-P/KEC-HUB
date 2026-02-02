from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv('MONGODB_URI'))

print('Total in kec_hub.sheet1:', client.kec_hub.sheet1.count_documents({}))
print()

# Search for darshan emails
samples = list(client.kec_hub.sheet1.find(
    {'Email ID': {'$regex': 'darshan', '$options': 'i'}}, 
    {'Name': 1, 'Email ID': 1, '_id': 0}
).limit(10))

print('Emails containing "darshan":')
for s in samples:
    print(f"  {s.get('Email ID')} - {s.get('Name')}")

print()
print('First 5 emails in sheet1:')
first_five = list(client.kec_hub.sheet1.find({}, {'Email ID': 1, 'Name': 1, '_id': 0}).limit(5))
for s in first_five:
    print(f"  {s.get('Email ID')} - {s.get('Name')}")

client.close()
