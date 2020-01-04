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
```
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
```
"scripts": {
    ...
    "test": "nyc --reporter=text mocha"
    ...
}
```
You can verify that everything is configure correctly by running `npm test` to view unit testing results and code coverage reports.

## Configuring Code Linting and Styling
