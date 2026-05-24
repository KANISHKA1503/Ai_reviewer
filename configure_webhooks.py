#!/usr/bin/env python3
"""
Configure GitHub webhooks automatically using GitHub API
"""
import requests
import json
import os

# GitHub credentials - use environment variable or token
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

if not GITHUB_TOKEN:
    print("❌ Error: GITHUB_TOKEN environment variable not set")
    print("Please set your GitHub token:")
    print("  export GITHUB_TOKEN=your_github_token_here")
    exit(1)

# Webhook configuration
WEBHOOK_URL = "https://ai-code-reviewer.loca.lt/webhook"
REPOSITORIES = [
    "KANISHKA1503/test_reviewer",
    "KANISHKA1503/Ai_reviewer"
]

headers = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

def add_webhook(repo, webhook_url):
    """Add webhook to a GitHub repository"""
    url = f"https://api.github.com/repos/{repo}/hooks"
    
    payload = {
        "name": "web",
        "active": True,
        "events": ["pull_request", "pull_request_synchronize", "push"],
        "config": {
            "url": webhook_url,
            "content_type": "json",
            "insecure_ssl": "0"
        }
    }
    
    print(f"\n📝 Adding webhook to {repo}...")
    print(f"   URL: {webhook_url}")
    
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code in [201, 200]:
        webhook_id = response.json().get("id")
        print(f"✅ Webhook added successfully! (ID: {webhook_id})")
        return True
    else:
        print(f"❌ Failed to add webhook")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        return False

def check_webhooks(repo):
    """Check existing webhooks for a repository"""
    url = f"https://api.github.com/repos/{repo}/hooks"
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        hooks = response.json()
        print(f"\n📋 Existing webhooks for {repo}:")
        if hooks:
            for hook in hooks:
                print(f"   - ID: {hook['id']}, URL: {hook['config']['url']}")
        else:
            print(f"   (No webhooks configured)")
        return hooks
    else:
        print(f"❌ Failed to fetch webhooks: {response.status_code}")
        return []

# Main execution
print("=" * 60)
print("🚀 GitHub Webhook Configuration Tool")
print("=" * 60)

if not GITHUB_TOKEN or GITHUB_TOKEN == "":
    print("\n⚠️  Warning: GitHub token not found!")
    print("\nTo configure webhooks automatically, please:")
    print("1. Generate a GitHub Personal Access Token:")
    print("   https://github.com/settings/tokens")
    print("   (Scopes needed: 'admin:repo_hook')")
    print("\n2. Run this script with your token:")
    print("   GITHUB_TOKEN=ghp_xxxx python configure_webhooks.py")
    exit(0)

print(f"\n✓ GitHub Token found (length: {len(GITHUB_TOKEN)})")
print(f"✓ Webhook URL: {WEBHOOK_URL}")
print(f"✓ Target repositories: {len(REPOSITORIES)}")

# Check and add webhooks
for repo in REPOSITORIES:
    print("\n" + "=" * 60)
    check_webhooks(repo)
    add_webhook(repo, WEBHOOK_URL)

print("\n" + "=" * 60)
print("✅ Webhook configuration complete!")
print("=" * 60)
