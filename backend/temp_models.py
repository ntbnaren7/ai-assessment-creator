import os
import json
import urllib.request

api_key = os.environ.get('GROQ_API_KEY')
if not api_key:
    from dotenv import load_dotenv
    load_dotenv('.env')
    api_key = os.environ.get('GROQ_API_KEY')

req = urllib.request.Request(
    'https://api.groq.com/openai/v1/models',
    headers={'Authorization': f'Bearer {api_key}'}
)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    models = [m['id'] for m in data['data']]
    print(json.dumps(models, indent=2))
