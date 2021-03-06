const Cloudant = require("@cloudant/cloudant");

const cloudant_id = process.env.CLOUDANT_ID || "<cloudant_id>";
const cloudant_apikey = process.env.CLOUDANT_IAM_APIKEY || "<cloudant_apikey>";

// UUID creation
const uuidv4 = require("uuid/v4");

var cloudant = new Cloudant({
  account: cloudant_id,

  plugins: {
    iamauth: {
      iamApiKey: cloudant_apikey,
    },
  },
});

// Cloudant DB reference
let db;
let db_name = "blockchain_db";

/**
 * Connects to the Cloudant DB, creating it if does not already exist
 * @return {Promise} - when resolved, contains the db, ready to go
 */
const dbCloudantConnect = () => {
  return new Promise((resolve, reject) => {
    Cloudant(
      {
        // eslint-disable-line
        account: cloudant_id,
        plugins: {
          iamauth: {
            iamApiKey: cloudant_apikey,
          },
        },
      },
      (err, cloudant) => {
        if (err) {
          console.log(
            "Connect failure: " +
              err.message +
              " for Cloudant ID: " +
              cloudant_id
          );
          reject(err);
        } else {
          cloudant.db
            .list()
            .then((body) => {
              if (!body.includes(db_name)) {
                console.log("DB Does not exist..creating: " + db_name);
                cloudant.db.create(db_name).then(() => {
                  if (err) {
                    console.log(
                      "DB Create failure: " +
                        err.message +
                        " for Cloudant ID: " +
                        cloudant_id
                    );
                    reject(err);
                  }
                });
              }
              let db = cloudant.use(db_name);
              console.log("Connect success! Connected to DB: " + db_name);
              resolve(db);
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        }
      }
    );
  });
};

// Initialize the DB when this module is loaded
(function getDbConnection() {
  console.log("Initializing Cloudant connection...", "getDbConnection()");
  dbCloudantConnect()
    .then((database) => {
      console.log("Cloudant connection initialized.", "getDbConnection()");
      db = database;
    })
    .catch((err) => {
      console.log(
        "Error while initializing DB: " + err.message,
        "getDbConnection()"
      );
      throw err;
    });
})();

function findBlood(bloodGroup) {
  console.log("inside findBlood");
  return new Promise((resolve, reject) => {
    let selector = {};
    if (bloodGroup) {
      selector["bloodGroup"] = bloodGroup;
    }
    console.log("Selector in findBlood: " + JSON.stringify(selector));

    db.find({ selector: selector }, (err, documents) => {
      console.log("Return from DB");
      if (err) {
        reject(err);
      } else {
        resolve({ data: JSON.stringify(documents.docs), statusCode: 200 });
      }
    });
  });
}

module.exports = {
  findBlood: findBlood,
};
