## Set up

This package can packed as a docker image in GCP and then used by Google Cloud Build process.

1. Run `gcloud iam service-accounts create spanner-schema-cli-builder`.
1. Run `gcloud projects add-iam-policy-binding phading-dev --member='serviceAccount:spanner-schema-cli-builder@phading-dev.iam.gserviceaccount.com' --role='roles/cloudbuild.builds.builder' --condition=None` replacing `phading-dev` with your GCP project id.
1. Run `gcloud projects add-iam-policy-binding phading-dev --member='serviceAccount:spanner-schema-cli-builder@phading-dev.iam.gserviceaccount.com' --role='roles/spanner.databaseAdmin' --condition=None` replacing `phading-dev` with your GCP project id.
1. Go to cloud build and set up a trigger with `@selfage/spanner_schema_update_cli`, using `cloudbuild.yaml` file in the repo, with two variables `_INSTANCE_ID` which points to an existing Spanner instance, and `_DATABASE_ID` which points to a test database to be created only during testing and deleted once testing is done. An executable docker image will be pushed to `gcr.io/${PROJECT_ID}/spanner_schema_update_cli`.
