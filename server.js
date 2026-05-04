
/* ================= BACKEND ================= */


const express=require('express');
const ytdl=require('ytdl-core');
const ffmpeg=require('fluent-ffmpeg');
const fs=require('fs');
const path=require('path');
const cors=require('cors');

const app=express();
app.use(cors());
app.use(express.json());

// 📁 Ensure folders exist
const videoDir = 'downloads/video';
const audioDir = 'downloads/audio';

if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

// 🧠 Clean filename function
function cleanFileName(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// 📺 Video info
app.post('/info', async (req,res)=>{
  let info=await ytdl.getInfo(req.body.url);
  res.json({
    success:true,
    title:info.videoDetails.title,
    thumbnail:info.videoDetails.thumbnails[0].url
  });
});

// 📥 Download with progress
app.get('/progress', async (req,res)=>{
  const {url,type}=req.query;
  const info = await ytdl.getInfo(url);

  const cleanTitle = cleanFileName(info.videoDetails.title);

  res.writeHead(200,{
    'Content-Type':'text/event-stream',
    'Cache-Control':'no-cache',
    'Connection':'keep-alive'
  });

  if(type==='audio'){
    const file=`${audioDir}/${cleanTitle}.mp3`;

    ffmpeg(ytdl(url,{quality:'highestaudio'}))
    .on('progress',p=>{
      res.write(`data: ${JSON.stringify({progress: Math.min(95, (p.percent||0))})}\n\n`);
    })
    .on('end',()=>{
      res.write(`data: ${JSON.stringify({progress:100,done:true,file})}\n\n`);
      res.end();
    })
    .save(file);

  } else {
    const file=`${videoDir}/${cleanTitle}.mp4`;

    let stream=ytdl(url);

    stream.on('progress',(chunk,downloaded,total)=>{
      let percent=(downloaded/total)*100;
      res.write(`data: ${JSON.stringify({progress:percent})}\n\n`);
    });

    stream.pipe(fs.createWriteStream(file))
    .on('finish',()=>{
      res.write(`data: ${JSON.stringify({progress:100,done:true,file})}\n\n`);
      res.end();
    });
  }
});

app.use(express.static('.'));
app.listen(3000,()=>console.log('Server running on http://localhost:3000'));