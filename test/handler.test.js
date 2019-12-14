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
