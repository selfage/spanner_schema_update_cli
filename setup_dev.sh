# GCP auth
gcloud auth application-default login

# Create service account
gcloud iam service-accounts create spanner-schema-cli-builder

# Add roles
gcloud projects add-iam-policy-binding phading-dev --member='serviceAccount:spanner-schema-cli-builder@phading-dev.iam.gserviceaccount.com' --role='roles/cloudbuild.builds.builder' --condition=None
gcloud projects add-iam-policy-binding phading-dev --member='serviceAccount:spanner-schema-cli-builder@phading-dev.iam.gserviceaccount.com' --role='roles/spanner.admin' --condition=None
