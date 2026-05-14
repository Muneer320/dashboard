FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt pyproject.toml README.md main.py ./
COPY app ./app
COPY docker ./docker

RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install \
      boto3==1.43.6 \
      google-api-python-client==2.187.0 \
      google-auth-httplib2==0.3.0 \
      google-auth-oauthlib==1.2.3 \
      redis==5.3.1

EXPOSE 8000

CMD ["/bin/sh", "/app/docker/start.sh"]
