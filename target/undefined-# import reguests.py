import requests
from urllib import parse
def get_html(url,time=10):
    head = {
        # "User-Agent":"Mozi11a/5.8 (windows NT 10.0;Win64;x64)" \
        #             "Applewebkit/537.36 (KHTML, like Gecko)" \
        #             "chrome/79.0.3945.88 Safari/537.36"
        "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                    "AppleWebKit/537.36 (KHTML, like Gecko)"
                     "Chrome/122.0.0.0 Safari/537.36"
        }
    try:
        r=requests.get(url,headers=head,timeout=time)
        r.encoding=r.apparent_encoding 
        r.raise_for_status()
        return r.text 
    except Exception as error:
        print("error is",error)

if __name__=="__main__":
    parm={
      "mobi1e":"17382321670",
      "action":"mobile"
}
    p=parse.urlencode(parm)
    url ="https://www.ip138.com/mobile.asp?"
    url=url+p 
    print(url)
    print(get_html(url))

