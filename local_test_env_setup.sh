#!/bin/bash

# Env variables
export PROJECT_ID=phading-dev
export INSTANCE_ID=test
export DATABASE_ID=test

# GCP auth
gcloud auth application-default login

# Spanner
gcloud spanner instances create test --config=regional-us-central1 --description="test" --edition=STANDARD --processing-units=100
