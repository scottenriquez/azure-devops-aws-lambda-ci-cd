# Azure DevOps CI/CD Pipeline for AWS Lambda Function
This project serves as an end-to-end working example for testing, building, linting, and deploying an AWS Lambda Node.js function to multiple environment using AWS CloudFormation, Azure Pipelines and Azure DevOps. The complete source code is located in [this GitHub repository](https://github.com/scottenriquez/azure-devops-aws-lambda-ci-cd "GitHub"), and the build output is pubicly available via [Azure DevOps](https://dev.azure.com/scottenriquez/AWS%20Lambda%20CI-CD/_build?definitionId=1&_a=summary "Azure DevOps build summary").

## Setting Up a Git Repository
Even though I'm using Azure Pipelines for CI/CD instead of Travis CI, you can easily host the code in a Git repository on Azure DevOps or on GitHub. Microsoft's GitHub integration is seamless, so there's no reason not to use it should you choose to host your source code there instead. All of the features like pull request integration and showing build status alongside each commit on GitHub behave exactly like Travis CI. To enable GitHub integration, simply navigate to the Azure DevOps project settings tab, select 'GitHub connections', then follow the wizard to select the GitHub repository to link.

## Creating an NPM Project for the Lambda Function
A simple `npm init` command will create the `package.json` file and populate relevant metadata for our Lambda function. All dependencies and development dependencies are documented there.

## Implementing a Sample Lambda Function
In the root of the project, there's a file called `index.js` with the Lambda function logic. For this example, the handler function simply returns a 200 status code with a serialized JSON body.
```javascript
exports.handler = async event => ({
  statusCode: 200,
  body: JSON.stringify('Hello from Lambda!'),
});
```

## Adding Unit Tests and Code Coverage
We'll need to install a few development dependencies using the command `npm install --save-dev mocha chai nyc`. After these are installed, we can add our first unit test to `test/handler.test.js`:
```javascript
const mocha = require('mocha');
const chai = require('chai');
const index = require('../index');

const { expect } = chai;
const { describe } = mocha;
const { it } = mocha;

describe('Handler', async () => {
  describe('#handler()', async () => {
    it('should return a 200 response with a body greeting the user from Lambda ', async () => {
      const expectedResponse = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
      };
      const actualResponse = await index.handler(null);
      expect(actualResponse).to.deep.equal(expectedResponse);
    });
  });
});
```
To configure code coverage rules for our CI/CD pipeline, add a `.nycrc` (Istanbul configuration) file to the root of the project. For this example, I've specified 80% across branches (i.e. if statement paths), lines, functions, and statements. You can also whitelist files to apply code coverage rules to with the `include` attribute.
```json
{
  "branches": 80,
  "lines": 80,
  "functions": 80,
  "statements": 80,
  "check-coverage": true,
  "all": true,
  "include": ["**.js"]
}
```

With this in place, wire up everything in the `package.json` with the proper test command:
```json
...
"scripts": {
    "test": "nyc --reporter=text mocha"
},
...
```
You can verify that everything is configure correctly by running `npm test` to view unit testing results and code coverage reports.

## Configuring Code Linting and Styling
It's important to think of linting and styling as two separate entities. Linting is part of the CI/CD pipeline and serves as static code analysis. This provides feedback on the code that could potentially cause bugs and should cause a failure in the pipeline if issues are found. Styling on the other hand is opinionated and provides readabilty and consistency across the codebase. However, it's not part of the build pipeline itself and should be run locally prior to a commit.

For configuring ESLint, I used [@wesbos' configuration](https://github.com/wesbos/eslint-config-wesbos "ESLint Setup") as a base using the command `npx install-peerdeps --dev eslint-config-wesbos`. Detailed instructions can be found in his README. This makes the `.eslintrc` config in the root quite clean:
```json
{
  "extends": [
    "wesbos"
  ]
}
``` 

Given that code styling is quite opinionated, I won't inject any biases here. To install Prettier, use the command `npm install prettier` and add `.prettierrc` and `.prettierignore` files to the root.

With this in place, you can add linting and Prettier commands to the `package.json`:
```json
...
"scripts": {
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --write \"**/*.{js,jsx,json,md}\""
},
...
```
Though there is no configuration managed in this repository for code styling, note that you can enable an IDE like Visual Studio Code or JetBrains' WebStorm to apply styling rules upon save.

## Enabling Continuous Integration Using Azure Pipelines
Via the Azure DevOps web UI, you can directly commit an initial `azure-pipelines.yml` file to the root of the repository and configure the trigger (i.e. commits). Once the NPM scripts are properly set up like above, the build stage can be configured to run the build, unit tests, and linting in a few lines of code.
```yaml
stages:
- stage: Build
  jobs:
  - job: BuildLambdaFunction
    pool:
      vmImage: 'ubuntu-latest'
    continueOnError: false
    steps:
      - task: NodeTool@0
        inputs:
          versionSpec: '12.x'
        displayName: 'Install Node.js'
      - script: |
          npm install
          npm run lint
          npm test
        displayName: 'NPM install, lint, and test'
      - task: ArchiveFiles@2
        inputs:
          rootFolderOrFile: '$(Build.SourcesDirectory)'
          includeRootFolder: true
          archiveType: 'zip'
          archiveFile: '$(Build.ArtifactStagingDirectory)/LambdaBuild.zip'
          replaceExistingArchive: true
          verbose: true
```
Note that for now, there is only one stage in the pipeline, but additional stages will be managed in the same YAML file. The code above spins up a Linux virtual machine, installs Node.js version 12.x, installs the dependencies specified in the `package.json` file, runs ESLint, and finally runs the unit tests. The logs are made available via Azure DevOps, and the virtual machine is destroyed after the build is complete. If an error occurs at any point (i.e lint issue, failed unit test, etc.), the build does not continue.

## Configuring Local Azure Pipeline Builds
As indicated by the nomenclature, Azure Pipelines run in the cloud. It's worth noting that it is possible to host your own build agents if you so choose. Setting it up does take quite a bit of configuration, so for this project I opted to use the cloud-hosted agent instead. Microsoft has [extensive documentation](https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/agents?view=azure-devops&tabs=browser "Self-hosted agents") for setting this up, and I've included the Dockerfile in the `dockeragent` directory.

## Enabling Infrastructure as Code Using AWS CloudFormation
One of the core goals of this project is to create a complete solution with everything from the source code to the build pipeline and cloud infrastructure managed under source control. CloudFormation is a technology from AWS that allows engineers to specify solution infrastructure as JSON or YAML. For this solution, I specified a Lambda function and an IAM role. Note that the build artifact will be sourced from an additional S3 staging bucket not detailed in the CloudFormation template.
```json
{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Resources": {
    "IAMLambdaRole": {
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Principal": {
                "Service": ["lambda.amazonaws.com"]
              },
              "Action": ["sts:AssumeRole"]
            }
          ]
        }
      }
    },
    "LambdaFunction": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
          "S3Bucket": "azdo-staging-s3-bucket",
          "S3Key": "build.zip"
        },
        "Handler": "index.handler",
        "Runtime": "nodejs12.x",
        "Role": {
          "Fn::GetAtt": ["IAMLambdaRole", "Arn"]
        }
      },
      "DependsOn": ["IAMLambdaRole"]
    }
  }
}
```
With this file in hand, creating or updating the infrastructure can be done via the command line using the AWS CLI. After generating an access key and secret key, the CLI can be installed and configured with a few commands. Note that I have specified the commands for Ubuntu (apt-get package manager) since that's the virtual machine image that was specified in the Azure Pipelines YAML.
```shell script
sudo apt-get install awscli
aws configure set aws_access_key_id $(AWS_ACCESS_KEY_ID)
aws configure set aws_secret_access_key $(AWS_SECRET_KEY_ID)
aws configure set aws_default_region $(AWS_DEFAULT_REGION)
```
**These keys should be treated like a username/password combination. Do not expose them in any public source code repositories or build logs. They should always be stored as secure environment variables in the build pipeline. Azure DevOps will always hide secure environment variables even in public project logs.**

After the CLI has been configured, the `aws cloudformation deploy` command will create or update the infrastructure specified in the template. I recommend testing this command locally before including it in the build pipeline.

## Enabling Multi-Stage and Multi-Environment Continuous Deployments 
With the ability to deploy cloud infrastructure, the build pipeline can now be a full CI/CD one. In the Azure DevOps UI, environments can be created via the project settings. For this project, I created development, test, and production. These will be referenced in the Azure Pipelines YAML script and capture a history of which build deployed which artifact.

Another stage can be added to the YAML script that depends on a successful build:
```yaml
- stage: DevelopmentDeployment
  dependsOn: Build
  jobs:
  - deployment: LambdaDevelopment
    pool:
      vmImage: 'ubuntu-latest'
    environment: 'Development'
    strategy:
      runOnce:
        deploy:
          steps:
          - script: |
              sudo apt-get install awscli
              aws configure set aws_access_key_id $(AWS_ACCESS_KEY_ID)
              aws configure set aws_secret_access_key $(AWS_SECRET_KEY_ID)
              aws configure set aws_default_region $(AWS_DEFAULT_REGION)
            displayName: 'install and configure AWS CLI'
          - script: |
              aws s3 cp $(Pipeline.Workspace)/LambdaBuild/s/$(AWS_CLOUDFORMATION_TEMPLATE_FILE_NAME) s3://$(AWS_S3_STAGING_BUCKET_NAME)
              aws s3 cp $(Pipeline.Workspace)/LambdaBuild/a/LambdaBuild.zip s3://$(AWS_S3_STAGING_BUCKET_NAME)
            displayName: 'upload CloudFormation template and Lambda function ZIP build to staging bucket'
          - script: |
              aws cloudformation deploy --stack-name $(AWS_STACK_NAME_DEVELOPMENT) --template-file $(Pipeline.Workspace)/LambdaBuild/s/$(AWS_CLOUDFORMATION_TEMPLATE_FILE_NAME) --tags Environment=Development --capabilities CAPABILITY_NAMED_IAM --no-fail-on-empty-changeset
            displayName: 'updating CloudFormation stack'
```
Note that I have parameterized certain inputs (i.e. `$(AWS_ACCESS_KEY_ID)`) as build environment variables to be reusable and secure. These are managed via settings in Azure DevOps and not committed to source control.

## A Note on Sharing Files Among Pipeline Stages
Because each stage in the Azure Pipeline spins up a separate virtual machine, files such as the build artifact are not immediately accessible between build stages. In the build stage, a task can be added to publish a pipeline artifact (accessible via the path `$(Pipeline.Workspace)` path) that can be shared between stages.
```yaml
- task: PublishPipelineArtifact@1
    inputs:
    targetPath: '$(Pipeline.Workspace)'
    artifact: 'LambdaBuild'
    publishLocation: 'pipeline'
```

## Security Checks
Most organizations will require some sort of human approval before migrating to production. This can be configured via Azure DevOps at an environment level. From the web UI, each environment can be configured with separate approvers.

## Limiting Production Deployments to the Master Branch Only
As part of a continuous deployment implementation, production migrations should happen every time that the master branch is updated via a pull request. However, all branches should still be privy to the CI/CD benefits. In the Azure Pipelines YAML script, the production stage can be configured to be skipped if the source branch is not master:
```yaml
- stage: ProductionDeployment
  condition: and(succeeded(), eq(variables['build.sourceBranch'], 'refs/heads/master'))
  dependsOn: TestDeployment
```
