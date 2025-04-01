const pulumi = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");
const docker = require("@pulumi/docker");
const fs = require("fs");

// Get configuration from Pulumi config
const config = new pulumi.Config();
const mongodbUri = config.requireSecret("mongodb_uri");

// Get GCP configuration
const gcpConfig = new pulumi.Config("gcp");
const gcpProject = gcpConfig.require("project");
const gcpRegion = gcpConfig.require("region");

// Create a GCP Artifact Registry repository
const repo = new gcp.artifactregistry.Repository("meteor-app-repo", {
    format: "DOCKER",
    location: gcpRegion,
    repositoryId: "meteor-app-repo",
    project: gcpProject,
});

// Build and push the Docker image
const imageName = pulumi.interpolate`${gcpRegion}-docker.pkg.dev/${gcpProject}/${repo.repositoryId}/meteor-app:latest`;

const image = new docker.Image("meteor-app-image", {
    imageName: imageName,
    build: {
        context: "../meteor-pulumi-app",
        dockerfile: "../meteor-pulumi-app/Dockerfile",
    },
    registry: {
        server: pulumi.interpolate`${gcpRegion}-docker.pkg.dev`,
        username: "_json_key",
        password: pulumi.secret(process.env.GOOGLE_APPLICATION_CREDENTIALS 
            ? fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS).toString() 
            : ""),
    },
});

// Define a service URL pattern
const serviceUrlPattern = pulumi.interpolate`meteor-app-${gcpProject}.${gcpRegion}.run.app`;

// Deploy the image to Cloud Run
const service = new gcp.cloudrun.Service("meteor-app-service", {
    location: gcpRegion,
    project: gcpProject,
    template: {
        spec: {
            containers: [{
                image: image.imageName,
                resources: {
                    limits: {
                        memory: "1Gi",
                        cpu: "1",
                    },
                },
                envs: [
                    // Remove the PORT environment variable as it's set automatically
                    {
                        name: "ROOT_URL",
                        value: pulumi.interpolate`https://${serviceUrlPattern}`,
                    },
                    {
                        name: "MONGO_URL",
                        value: mongodbUri,
                    },
                ],
            }],
            containerConcurrency: 80,
        },
    },
});

// Make the Cloud Run service publicly accessible
const iamMember = new gcp.cloudrun.IamMember("meteor-app-everyone", {
    service: service.name,
    location: gcpRegion,
    project: gcpProject,
    role: "roles/run.invoker",
    member: "allUsers",
});

// Export the service URL
exports.url = service.statuses[0].url;