cd client
call npm install

cd ..\server
call npm install

cd ..\app
call python3 -m venv .venv
call .venv\scripts\activate
call pip install -r requirements.txt