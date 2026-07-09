import http.server
import socketserver
import socket
import json
import os
import sys

PORT = 8080

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't need to be reachable, just triggers OS to find local interface IP
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

class MeituanHelperHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress noise, but print errors
        if args and isinstance(args[0], str) and ('404' in args[0] or '500' in args[0]):
            super().log_message(format, *args)
            
    def do_GET(self):
        if self.path == '/api/ip':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            local_ip = get_local_ip()
            response = {
                "ip": local_ip,
                "port": PORT
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            # Serve files from the directory of this script
            super().do_GET()

def run_server():
    # Change directory to the script's directory so it serves files correctly
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    local_ip = get_local_ip()
    
    print("=" * 60)
    print("        美团外卖返现与优惠商家匹配助手 本地服务启动中        ")
    print("=" * 60)
    print(f"本地电脑访问地址: http://localhost:{PORT}")
    print(f"手机同Wi-Fi访问地址: http://{local_ip}:{PORT}")
    print("-" * 60)
    print("使用提示:")
    print("1. 确保您的手机和这台电脑连接在同一个 Wi-Fi 网络下。")
    print("2. 在电脑上打开 http://localhost:8080，页面会显示一个二维码。")
    print("3. 用手机微信扫一扫该二维码，即可在手机上直接打开匹配网页。")
    print("=" * 60)
    
    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), MeituanHelperHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n服务已停止。")
            sys.exit(0)

if __name__ == '__main__':
    run_server()
