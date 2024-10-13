const path = require("path");

module.exports = {
  mode: "development", // Changed from "production" to "development"
  devtool: "inline-source-map", // Add this line
  entry: {
    contentScript: "./src/contentScript.js",
    background: "./src/background.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js", // Will output 'contentScript.js' and 'background.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
};
