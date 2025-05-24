# band-bot

Telegram bot JS


## How to set up a Database:

#### 1️⃣ Check PostgreSQL Service

Install:
```bash
brew instal postgres
```

Ensure PostgreSQL is running:
```bash
pg_isready -h localhost -p 5432
```

If it’s not running, start it:
```bash
brew services start postgresql
```

#### 2️⃣ Connect to PostgreSQL

Open the terminal and run:
```bash
psql -h localhost -U postgres
```
Replace postgres with your superuser name if different.

#### 3️⃣ Create Database
In the `psql` prompt, create the database playlist:
```sql
CREATE DATABASE playlist;
```
