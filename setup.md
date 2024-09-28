## Set up

This package can packed as a docker image in GCP and then used by Google Cloud Build process.

1. Run `gcloud iam service-accounts create spanner-schema-cli-builder`.
1. Run `gcloud projects add-iam-policy-binding phading-dev --member='serviceAccount:spanner-schema-cli-builder@phading-dev.iam.gserviceaccount.com' --role='roles/cloudbuild.builds.builder' --condition=None` replacing `phading-dev` with your GCP project id.
1. Run `gcloud projects add-iam-policy-binding phading-dev --member='serviceAccount:spanner-schema-cli-builder@phading-dev.iam.gserviceaccount.com' --role='roles/spanner.databaseAdmin' --condition=None` replacing `phading-dev` with your GCP project id.
1. Go to cloud build and set up a trigger with `@selfage/spanner_schema_update_cli`, using `cloudbuild.yaml` file in the repo, with two variables `_INSTANCE_ID` which points to an existing Spanner instance, and `_DATABASE_ID` which points to a test database to be created only during testing and deleted once testing is done. An executable docker image will be pushed to `gcr.io/${PROJECT_ID}/spanner_schema_update_cli`.

## Local Spanner emulator

### Install gcloud if not alraedy

https://cloud.google.com/sdk/docs/install

Run `gcloud init`.

### Prepare gcloud emulator config

```
gcloud config configurations create emulator
gcloud config set auth/disable_credentials true
gcloud config set project local-project
gcloud config set api_endpoint_overrides/spanner http://localhost:9020/
```

### Switch back

To switch between the emulator and default configuration, run: `gcloud config configurations activate [emulator | default]`

### Install local Spanner emulator

`sudo apt-get install google-cloud-cli-spanner-emulator`

Reference: https://cloud.google.com/spanner/docs/emulator

### Run the emulator

`npx spanage rle <ddlFile>`

Keep the cli running and open another cli window to run your test file.

To point to the emulator in your test file, set `process.env.SPANNER_EMULATOR_HOST = SPANNER_EMULATOR_HOST` where `SPANNER_EMULATOR_HOST` can be imported from `constants.ts`.

Then use the project, instance and database from `constants.ts` to initiate `Spanner` class.
