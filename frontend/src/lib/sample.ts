/** Deliberately vulnerable snippet so visitors can try the analyzer without their own code. */
export const SAMPLE_CODE = `import os
import pickle
import sqlite3
import subprocess
import hashlib

from flask import Flask, request

app = Flask(__name__)
SECRET_KEY = "super-secret-admin-password"


@app.route("/user")
def get_user():
    name = request.args.get("name")
    conn = sqlite3.connect("app.db")
    # SQL injection
    row = conn.execute("SELECT * FROM users WHERE name = '" + name + "'").fetchone()
    return str(row)


@app.route("/ping")
def ping():
    host = request.args.get("host")
    # Command injection
    return subprocess.check_output("ping -c 1 " + host, shell=True)


@app.route("/load", methods=["POST"])
def load():
    # Insecure deserialization
    return str(pickle.loads(request.data))


def hash_password(password: str) -> str:
    # Weak hash
    return hashlib.md5(password.encode()).hexdigest()


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
`;
