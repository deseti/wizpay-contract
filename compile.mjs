import { exec } from "child_process";
import fs from "fs";

exec("npx hardhat compile", (err, stdout, stderr) => {
  const output = `ERR: ${err ? err.code : 'null'}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
  fs.writeFileSync("compile_out_utf8.txt", output, "utf-8");
  console.log("Done");
});
