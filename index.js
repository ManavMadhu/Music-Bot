const Discord = require("discord.js");
const { prefix } = require("./config.json");
const ytdl = require("ytdl-core");
const ytsh = require("yt-search");
require("dotenv").config();
const client = new Discord.Client();
const express = require("express");
const app = express();
const path = require("path");

const queue = new Map();

client.once("ready", () => {
  console.log("Ready!");
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});

client.on("message", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = await queue.get(message.guild.id);

  if (
    message.content.startsWith(`${prefix}p `) ||
    message.content.startsWith(`${prefix}play `)
  ) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}help`)) {
    help(message);
    return;
  } else if (
    message.content.startsWith(`${prefix}pause`) ||
    message.content === `${prefix}p`
  ) {
    pause(message, serverQueue);
    return;
  } else if (
    message.content.startsWith(`${prefix}remove`) ||
    message.content.startsWith(`${prefix}r `)
  ) {
    removeSong(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}resume`)) {
    resume(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}dc`)) {
    stop(message, serverQueue);
    return;
  } else if (
    message.content.startsWith(`${prefix}queue`) ||
    message.content.startsWith(`${prefix}q`)
  ) {
    queueList(message, serverQueue);
    return;
  } else {
    message.channel.send("You need to enter a valid command!!");
  }
});

async function execute(message, serverQueue) {
  const args = message.content.split(" ");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to play music!"
    );
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I need the permissions to join and speak in your voice channel!!"
    );
  }

  let song;
  if (ytdl.validateURL(args[1])) {
    const songInfo = await ytdl.getInfo(args[1]);
    //console.log(args[1]);
    //console.log(songInfo.videoDetails.title);
    //if (songInfo === null) return message.channel.send("Song cannot be added!");
    song = {
      title: songInfo.videoDetails.title,
      url: args[1],
    };
  } else {
    const { videos } = await ytsh(args.slice(1).join(" "));
    //console.log(videos);
    if (!videos.length) return message.channel.send("No songs were found!");
    song = {
      title: videos[0].title,
      url: videos[0].url,
    };
  }

  console.log(song);

  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true,
    };

    queue.set(message.guild.id, queueContruct);

    queueContruct.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      play(message.guild, queueContruct.songs[0]);
    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    serverQueue.songs.push(song);
    return message.channel.send(`${song.title} has been added to the queue!`);
  }
}

function help(message) {
  const botInfo = new Discord.MessageEmbed().setDescription(
    "You can see the commands [here!](https://music-bot-110.herokuapp.com/)"
  );

  message.channel.send(botInfo);
}

function queueList(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to see the queue!"
    );
  if (!serverQueue.songs)
    return message.channel.send("There is no song in the List!");
  else {
    let queueText = "";

    serverQueue.songs.map((songDetails, queueIndex) => {
      queueText +=
        JSON.stringify(queueIndex + 1) + ") " + songDetails.title + "\n";
    });
    // queueText = JSON.parse(queueText);
    return message.channel.send(queueText);
    //console.log(serverQueue.songs);
  }
}

function removeSong(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to remove the song!"
    );
  if (!serverQueue.songs)
    return message.channel.send("There is no song in the List!");
  else {
    let num = message.content.replace(/[^0-9]/g, "");
    if (!num) return message.channel.send("Enter a Valid Number!");
    //console.log(num);
    let index = parseInt(num) - 1;
    message.channel.send(
      `${serverQueue.songs[index].title} has been removed from the queue!`
    );
    if (index > -1) {
      serverQueue.songs.splice(index, 1);
      console.log(serverQueue.songs);
    }
  }
}

function skip(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song that I could skip!");
  serverQueue.connection.dispatcher.end();
}

function pause(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to pause the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song that I could pause!");
  message.channel.send("You have paused the song!");
  serverQueue.connection.dispatcher.pause(serverQueue.songs);
  return;
}

function resume(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to resume the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song that I could resume!");
  serverQueue.connection.dispatcher.resume();
}

function stop(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );

  if (!serverQueue)
    return message.channel.send("There is no song that I could stop!");

  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", (error) => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(`Now playing: **${song.title}**`);
}

client.login(process.env.token);
// app.set("view engine", "html");
app.get("/", (req, res) => {
  //res.send(true);
  res.sendFile(path.join(__dirname + "/frontend.html"));
});
app.listen(process.env.PORT || 3000, () => {
  console.log("server online");
});
