exports.default = async function sign(configuration) {
  // Local unpacked build: skip signing to avoid winCodeSign symlink failure on Windows
  return true;
};
