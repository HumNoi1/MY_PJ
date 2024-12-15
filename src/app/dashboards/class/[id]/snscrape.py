import snscrape.modules.twitter as sntwitter
import pandas as pd
from datetime import datetime, timedelta

def scrape_btc_tweets(days_ago=7, limit=1000):
    """
    ดึงทวีตที่มี #BTC ในช่วงเวลาที่กำหนด
    
    Parameters:
    days_ago (int): จำนวนวันย้อนหลังที่ต้องการดึงข้อมูล
    limit (int): จำนวนทวีตสูงสุดที่ต้องการดึง
    """
    # กำหนดวันที่เริ่มต้น
    start_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
    
    # สร้าง query
    query = f"#BTC since:{start_date}"
    
    # สร้าง list เก็บทวีต
    tweets_list = []
    
    # ดึงข้อมูลทวีต
    for i, tweet in enumerate(sntwitter.TwitterSearchScraper(query).get_items()):
        if i >= limit:
            break
            
        tweets_list.append({
            'date': tweet.date,
            'username': tweet.user.username,
            'content': tweet.rawContent,
            'likes': tweet.likeCount,
            'retweets': tweet.retweetCount,
            'replies': tweet.replyCount,
            'language': tweet.lang,
            'url': tweet.url
        })
    
    # สร้าง DataFrame
    df = pd.DataFrame(tweets_list)
    
    # บันทึกเป็น CSV
    filename = f"btc_tweets_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    df.to_csv(filename, index=False, encoding='utf-8-sig')
    
    print(f"บันทึกข้อมูลลงไฟล์ {filename} เรียบร้อยแล้ว")
    print(f"จำนวนทวีตที่ดึงได้: {len(tweets_list)}")
    
    return df

# ตัวอย่างการใช้งาน
if __name__ == "__main__":
    # ดึงทวีตย้อนหลัง 7 วัน จำนวนสูงสุด 1000 ทวีต
    tweets_df = scrape_btc_tweets(days_ago=7, limit=1000)
    
    # แสดงตัวอย่างข้อมูล
    print("\nตัวอย่างข้อมูล:")
    print(tweets_df.head())