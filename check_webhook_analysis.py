#!/usr/bin/env python3
"""Query database for the latest webhook test analysis"""
import sqlite3
import json

conn = sqlite3.connect('reviews.db')
cur = conn.cursor()

# Get the latest review from test_reviewer for PR that just pushed
cur.execute('''
    SELECT id, repo_full_name, pr_number, pr_title, status, score, 
           total_findings, findings_json, error_message, created_at 
    FROM reviews 
    WHERE repo_full_name = "KANISHKA1503/test_reviewer"
    ORDER BY id DESC 
    LIMIT 1
''')

row = cur.fetchone()
if row:
    review_id, repo, pr_num, title, status, score, findings_count, findings_json, error, created = row
    
    print("\n" + "="*70)
    print("✅ WEBHOOK ANALYSIS RESULTS")
    print("="*70)
    print(f"Review ID: {review_id}")
    print(f"Repository: {repo}")
    print(f"PR Number: {pr_num}")
    print(f"PR Title: {title}")
    print(f"Status: {status}")
    print(f"Score: {score}/100" if score else "Score: Analyzing...")
    print(f"Total Findings: {findings_count}")
    print(f"Created At: {created}")
    
    if error:
        print(f"❌ Error: {error}")
    
    if findings_json:
        findings = json.loads(findings_json)
        print(f"\n📋 Findings ({len(findings)} issues):")
        for i, finding in enumerate(findings[:5], 1):  # Show first 5
            print(f"\n  {i}. [{finding.get('severity', 'UNKNOWN').upper()}] {finding.get('title', 'Unknown')}")
            print(f"     File: {finding.get('filename', 'unknown')}")
            print(f"     Line: {finding.get('line_number', 'N/A')}")
            print(f"     Recommendation: {finding.get('recommendation', 'N/A')[:100]}...")
    
    print("\n" + "="*70)
else:
    print("\n❌ No review found for test_reviewer")
    print("\nRecent reviews:")
    cur.execute('SELECT id, repo_full_name, pr_number, status FROM reviews ORDER BY id DESC LIMIT 5')
    for row in cur.fetchall():
        print(f"  ID: {row[0]}, Repo: {row[1]}, PR: {row[2]}, Status: {row[3]}")

conn.close()
