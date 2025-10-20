import './styles/playerStatusStyle.css'

import {GameMetadata, Participant} from "./types/windowLiveTypes";

import React, {useEffect, useState} from "react";
import {ToastContainer, toast} from 'react-toastify';
import {Frame as FrameWindow} from "./types/windowLiveTypes";
import {Team} from "./types/detailsPersistentTypes";

// Import audio assets via ESM for Vite compatibility
import kill from "../../assets/audios/champion_killed.ogg";
import tower_blue from "../../assets/audios/blue_tower_destroyed.ogg";
import tower_red from "../../assets/audios/red_tower_destroyed.ogg";
import dragon_blue from "../../assets/audios/blue_dragon.ogg";
import dragon_red from "../../assets/audios/red_dragon.ogg";
import baron_blue from "../../assets/audios/blue_baron.ogg";
import baron_red from "../../assets/audios/red_baron.ogg";
import inib_blue from "../../assets/audios/blue_inib_destroyed.ogg";
import inib_red from "../../assets/audios/red_inib_destroyed.ogg";

type Props = {
    lastFrameWindow: FrameWindow,
    gameMetadata: GameMetadata,
    blueTeam: Team,
    redTeam: Team,
    isLive?: boolean, // Add isLive prop to control notifications
}

type StatusWatcher = {
    inhibitors: {
        blue: number,
        red: number
    }
    dragons: {
        blue: number,
        red: number
    }
    towers: {
        blue: number,
        red: number
    }
    barons: {
        blue: number,
        red: number
    }
    participants: {
        blue: Participant[]
        red: Participant[]
    }
}

export function LiveAPIWatcher({ lastFrameWindow, gameMetadata, blueTeam, redTeam, isLive = true } : Props) {
    const [status, setStatus] = useState<StatusWatcher>({
        dragons: {blue: lastFrameWindow.blueTeam.dragons.length, red: lastFrameWindow.redTeam.dragons.length},
        inhibitors: {blue: lastFrameWindow.blueTeam.inhibitors, red: lastFrameWindow.redTeam.inhibitors},
        towers: {blue: lastFrameWindow.blueTeam.towers, red: lastFrameWindow.redTeam.towers},
        barons: {blue: lastFrameWindow.blueTeam.barons, red: lastFrameWindow.redTeam.barons},
        participants: {blue: lastFrameWindow.blueTeam.participants, red: lastFrameWindow.redTeam.participants}
    })

    useEffect(() => {
        // Only show notifications and play sounds in live mode
        if (!isLive) return;

        const soundData = localStorage.getItem("sound");
        let isMuted = false;
        if(soundData) {
            if (soundData === "mute") {
                isMuted = true;
            }else if(soundData === "unmute"){
                isMuted = false;
            }
        }

        // Topo = prioridade para o som
        let isPlaying = isMuted;

        if(status.inhibitors.blue !== lastFrameWindow.blueTeam.inhibitors){
            createToast(true, isPlaying, inib_red, "Destroyed an inhibitor", blueTeam.image);
            isPlaying = true
        }

        if(status.inhibitors.red !== lastFrameWindow.redTeam.inhibitors){
            createToast(false, isPlaying, inib_blue, "Destroyed an inhibitor", redTeam.image);
            isPlaying = true
        }

        if(status.barons.blue !== lastFrameWindow.blueTeam.barons){
            createToast(true, isPlaying, baron_blue, "Baron taken", blueTeam.image);
            isPlaying = true
        }

        if(status.barons.red !== lastFrameWindow.redTeam.barons){
            createToast(false, isPlaying, baron_red, "Baron taken", redTeam.image);
            isPlaying = true
        }

        if(status.dragons.blue !== lastFrameWindow.blueTeam.dragons.length){
            createToast(true, isPlaying, dragon_blue, "Dragon taken", blueTeam.image);
            isPlaying = true
        }

        if(status.dragons.red !== lastFrameWindow.redTeam.dragons.length){
            createToast(false, isPlaying, dragon_red, "Dragon taken", redTeam.image);
            isPlaying = true
        }

        if(status.towers.blue !== lastFrameWindow.blueTeam.towers){
            createToast(true, isPlaying, tower_red, "Destroyed a tower", blueTeam.image);
            isPlaying = true
        }

        if(status.towers.red !== lastFrameWindow.redTeam.towers){
            createToast(false, isPlaying, tower_blue, "Destroyed a tower", redTeam.image);
            isPlaying = true
        }

        for (let i = 0; i < status.participants.blue.length; i++) {
            if(status.participants.blue[i].kills !== lastFrameWindow.blueTeam.participants[i].kills){
                createToast(true, isPlaying, kill, "Got a kill", `http://ddragon.leagueoflegends.com/cdn/15.20.1/img/champion/${gameMetadata.blueTeamMetadata.participantMetadata[status.participants.blue[i].participantId - 1].championId}.png`)
                isPlaying = true
            }
        }

        for (let i = 0; i < status.participants.red.length; i++) {
            if(status.participants.red[i].kills !== lastFrameWindow.redTeam.participants[i].kills){
                createToast(false, isPlaying, kill, "Got a kill", `http://ddragon.leagueoflegends.com/cdn/15.20.1/img/champion/${gameMetadata.redTeamMetadata.participantMetadata[status.participants.red[i].participantId - 6].championId}.png`)
                isPlaying = true
            }
        }

        setStatus({
            dragons: {blue: lastFrameWindow.blueTeam.dragons.length, red: lastFrameWindow.redTeam.dragons.length},
            inhibitors: {blue: lastFrameWindow.blueTeam.inhibitors, red: lastFrameWindow.redTeam.inhibitors},
            towers: {blue: lastFrameWindow.blueTeam.towers, red: lastFrameWindow.redTeam.towers},
            barons: {blue: lastFrameWindow.blueTeam.barons, red: lastFrameWindow.redTeam.barons},
            participants: {blue: lastFrameWindow.blueTeam.participants, red: lastFrameWindow.redTeam.participants},
        })
    }, [lastFrameWindow.blueTeam.totalKills, lastFrameWindow.blueTeam.dragons.length, lastFrameWindow.blueTeam.inhibitors, lastFrameWindow.redTeam.totalKills, lastFrameWindow.redTeam.dragons.length, lastFrameWindow.redTeam.inhibitors, status.dragons.blue, status.dragons.red, status.barons.blue, status.barons.red, status.inhibitors.blue, status.inhibitors.red, status.towers.blue, status.towers.red, status.participants.blue, status.participants.red, lastFrameWindow.blueTeam.barons, lastFrameWindow.blueTeam.towers, lastFrameWindow.blueTeam.participants, lastFrameWindow.redTeam.barons, lastFrameWindow.redTeam.towers, lastFrameWindow.redTeam.participants, gameMetadata.blueTeamMetadata.participantMetadata, gameMetadata.redTeamMetadata.participantMetadata, blueTeam.image, redTeam.image, isLive]);

    return (
        <ToastContainer/>
    );
}

function createToast(blueTeam: boolean, soundIsPlaying: boolean, sound: string, message: string, image: string) {
    if(!soundIsPlaying) {
        let audio = new Audio(sound);
        audio.load();
        audio.volume = 0.20;
        audio.play();
    }

    if(blueTeam){
        toast.info(
            <div className="toast-watcher">
                <div className="toast-image">
                    <img src={image} alt="blue team"/>
                </div>
                <h4 style={{color: "#FFF"}}>{message}</h4>
            </div>
            , {
                pauseOnFocusLoss: false,
                position: toast.POSITION.TOP_LEFT,
                style: { background: 'var(--blue-twitter)', color: '#FFF' },
                progressStyle: { background: '#FFF' }
            }
        )
    }else{
        toast.error(
            <div className="toast-watcher">
                <img className="toast-image" src={image} alt="red team"/>
                <h4 style={{color: "#FFF"}}>{message}</h4>
            </div>
            , {
                pauseOnFocusLoss: false,
                position: toast.POSITION.TOP_RIGHT,
                style: { background: 'var(--red)', color: '#FFF' },
                progressStyle: { background: '#FFF' }
            }
        )
    }
}
