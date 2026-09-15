import json
import urllib.request
import os

PHISHTANK_URL = "http://data.phishtank.com/data/online-valid.json"
OUTPUT_FILE = "phishtank_domains.txt"

def extract_domain(url):
    try:
        domain = url.split('//')[-1].split('/')[0].split(':')[0].lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except:
        return ""

print("Downloading latest PhishTank database...")
try:
    # MAGIC FIX: Gumamit tayo ng Custom User-Agent para hindi ma-block ng PhishTank!
    req = urllib.request.Request(PHISHTANK_URL, headers={'User-Agent': 'phishtank/phishguard-bot-v1.0'})
    
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
    
    # Extract ONLY valid phishes
    valid_domains = set()
    for item in data:
        if item.get("verified") == "yes" and item.get("valid") == "yes":
            dom = extract_domain(item.get("url", ""))
            if dom:
                valid_domains.add(dom)
                
    # Save to a tiny, lightweight text file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for d in sorted(valid_domains):
            f.write(f"{d}\n")
            
    print(f"✅ Successfully extracted {len(valid_domains)} valid domains!")
    
except Exception as e:
    print(f"❌ Error updating PhishTank: {e}")
    # SAFETY NET: Kapag nag-error, gagawa tayo ng blankong file para hindi mag-crash ang GitHub!
    if not os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write("")
        print("Created a blank fallback file to prevent GitHub crashes.")
