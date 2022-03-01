const axios = require("axios");
const fs = require("fs");
const extract = require("extract-zip");
const commander = require("commander");
const packageJson = require("./package.json");
const TolgeeUtils = require("./lib/tolgee-utils.js");

var default_output_dir = "translations";
var default_api_url = "https://app.tolgee.io/";
var apiKeys = {};

// Init script arguments
commander
  .version(packageJson.version, "-v, --version")
  .usage("[OPTIONS]...")
  .option("-u, --url <value>", "api url", default_api_url)
  .option("-k, --apiKey <value>", "api key")
  .option("-m, --multiple <value>", "conf file for multiple projects")
  .option("-o, --output <value>", "translations output dir", default_output_dir)
  .parse(process.argv);

const options = commander.opts();

let canStart = true;

// Display active arguments
console.info("-------------------");
console.info("Used parameters :");
console.info("url=" + options.url);
console.info("output=" + options.output);
if (options.apiKey) {
  console.info("apiKey=" + options.apiKey);
}
if (options.multiple) {
  console.info("multiple=" + options.multiple);

  try {
    if (fs.existsSync(options.multiple)) {
      apiKeys = require(options.multiple);
      console.info("keys :");
      console.info(apiKeys);
    } else {
      canStart = false;
      console.error("Error : Error config file for multiple imports not found");
    }
  } catch (err) {
    console.error("Error : Error while checking if conf file exists :");
    console.error(err);
  }
}
console.info("-------------------");

if (canStart) {
  // Start the import
  startImport();
}

async function startImport() {
  // Erase previous imported translations if exists
  fs.rmSync(process.cwd() + "/" + options.output, {
    recursive: true,
    force: true,
  });

  // If multiple projects
  if (options.multiple) {
    for (const key of Object.keys(apiKeys)) {
      await importTranslation(apiKeys[key], key);
    }
  } else {
    await importTranslation(options.apiKey);
  }

  console.info("Import successfully completed !");
}

// Import translations from tolgee (provide api key and folder if multiple imports)
async function importTranslation(apiKey, folder = null) {
  var fullUrl =
    options.url +
    TolgeeUtils.endpoints.exportZip +
    TolgeeUtils.apiKeyParam(apiKey);

  // If multiple name the output zip with name
  if (folder) {
    outputZip = folder + ".zip";
  } else {
    outputZip = "output.zip";
  }

  try {
    // Download zip file
    await downloadZip(fullUrl, outputZip);
    // Set the extract folder for the zip
    var extractDir = process.cwd() + "/" + options.output;
    // On multiple import add subfolder
    if (folder) {
      extractDir += "/" + folder;
    }

    // Extract the zip
    await extractZip(outputZip, extractDir, folder, true);
  } catch (error) {
    console.error("Error: Error while downloading zip file");
    console.error(error);
  }
}

async function extractZip(
  zipFile,
  extractDir,
  folder = null,
  deleteAfter = true
) {
  await extract(zipFile, {
    dir: extractDir,
  }).then(function () {
    if (folder) {
      console.info(folder + ": Completed !");
    } else {
      console.info("Import: Completed !");
    }

    if (deleteAfter) {
      // Delete zip file after operation
      deleteZip(zipFile);
    }
  });
}

// Download and write zip file from the url to the output folder provided
async function downloadZip(url, output) {
  const writer = fs.createWriteStream(output);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

function deleteZip(path) {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
}
