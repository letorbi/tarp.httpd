var server = require("../server");

server.run(server.config({
  hooks: {
    "*": { GET }
  },
  port: 8000,
  workers: 2
}))();

function GET() {
  console.log("Sending 'Hello world'...");
  return "Hello world";
}
