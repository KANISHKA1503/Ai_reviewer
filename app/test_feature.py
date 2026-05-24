"""
Test Feature for Agentic AI Review

This module demonstrates a new feature with potential code issues
that the agentic AI agent should analyze and identify.
"""

def calculate_average(numbers):
    """Calculate average of numbers - intentional issue: no error handling."""
    total = sum(numbers)
    return total / len(numbers)  # Could divide by zero


def process_data(data):
    """Process data with security consideration needed."""
    # TODO: Add input validation
    result = []
    for item in data:
        result.append(item.upper())
    return result


def fetch_user_data(user_id):
    """Fetch user data - hardcoded credentials (security issue)."""
    # This would be a security concern in production
    username = "admin"
    password = "password123"
    # Fetch from API using credentials
    return {"id": user_id, "name": f"User_{user_id}"}


def format_output(data):
    """Format output - inconsistent with codebase style."""
    output=""
    for item in data:
        output=output+str(item)+","
    return output
