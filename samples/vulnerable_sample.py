"""Sample of intentionally VULNERABLE code for testing the analyzer. Do not use."""

import hashlib
import os
import pickle
import random
import sqlite3
import subprocess

import yaml

SECRET_KEY = "super-secret-key-12345"  # hard-coded secret
DB_PASSWORD = "admin123"


def get_user(username):
    conn = sqlite3.connect("app.db")
    # SQL injection
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    return conn.execute(query).fetchall()


def list_directory(name):
    # OS command injection
    os.system("ls -l " + name)
    return subprocess.check_output("cat " + name, shell=True)


def read_user_file(filename):
    # Path traversal
    with open("/srv/app/files/" + filename) as f:
        return f.read()


def hash_password(password):
    # Weak, unsalted hash
    return hashlib.md5(password.encode()).hexdigest()


def new_session_token():
    # Predictable token
    return str(random.randint(100000, 999999))


def load_session(data):
    # Insecure deserialization
    return pickle.loads(data)


def load_config(text):
    # Unsafe YAML load
    return yaml.load(text, Loader=yaml.Loader)


def calculate(expr):
    # Arbitrary code execution
    return eval(expr)


if __name__ == "__main__":
    # Debug server exposed on all interfaces
    from flask import Flask

    app = Flask(__name__)
    app.run(host="0.0.0.0", debug=True)
