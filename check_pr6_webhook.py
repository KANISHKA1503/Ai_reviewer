#!/usr/bin/env python3
"""Check the latest webhook analysis for test_reviewer"""
import sqlite3
import json

conn = sqlite3.connect('reviews.db')
cur = conn.cursor()

# Get recent reviews from test_reviewer
cur.execute('''
    SELECT id, repo_full_name, pr_number, pr_title, status, score, 
           total_findings, findings_json, error_message
    FROM reviews 
    WHERE repo_full_name = "KANISHKA1503/test_reviewer"
    ORDER BY id DESC 
    LIMIT 5
''')

rows = cur.fetchall()
print("\n" + "="*80)
print("RECENT WEBHOOK ANALYSES - test_reviewer")
print("="*80)

for row in rows:
    review_id, repo, pr_num, title, status, score, findings_count, findings_json, error = row
    print(f"\nReview ID: {review_id} | PR: #{pr_num} | Status: {status.upper()}")
    print(f"  Score: {score}/100 | Findings: {findings_count}")
    if error:
        print(f"  Error: {error}")

# Show detailed info for PR #6
cur.execute('''
    SELECT id, pr_title, status, score, total_findings, findings_json, created_at
    FROM reviews 
    WHERE repo_full_name = "KANISHKA1503/test_reviewer" AND pr_number = 6
    ORDER BY id DESC 
    LIMIT 1
''')

pr6 = cur.fetchone()
if pr6:
    review_id, title, status, score, findings_count, findings_json, created_at = pr6
    print("\n" + "="*80)
    print(f"✅ PR #6 WEBHOOK ANALYSIS FOUND!")
    print("="*80)
    print(f"Review ID: {review_id}")
    print(f"Status: {status.upper()}")
    print(f"Score: {score}/100" if score else "Score: Analyzing...")
    print(f"Total Findings: {findings_count}")
    print(f"Created At: {created_at}")
    
    if findings_json:
        findings = json.loads(findings_json)
        print(f"\n📋 Issues Found ({len(findings)}):")
        for i, finding in enumerate(findings[:10], 1):
            print(f"\n  {i}. [{finding.get('severity', 'UNKNOWN')}] {finding.get('title', 'Unknown')}")
            print(f"     File: {finding.get('filename', 'unknown')}")
            print(f"     Line: {finding.get('line_number', 'N/A')}")
            if finding.get('recommendation'):
                print(f"     Fix: {finding.get('recommendation')[:80]}...")
else:
    print("\n❌ PR #6 not found in database yet")
    print("Webhook may still be processing...")

conn.close()
