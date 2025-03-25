// 重定向到主页
module.exports = (req, res) => {
  res.writeHead(302, { Location: '/index.html' });
  res.end();
}; 