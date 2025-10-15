import './styles/livegameStyle.css'

import {getLiveGames, getSchedule} from "../../utils/LoLEsportsAPI";
import {GameCardList} from "./GameCardList";
import {useEffect, useState} from "react";

import {Event as LiveEvents} from "./types/liveGameTypes";
import {Event as TodayEvent} from "./types/scheduleType";
import {filterGamesByTimeWindow, getCurrentUTCTime} from "../../utils/timestampUtils";

export function LiveGames() {
    const [liveEvents, setLiveEvents] = useState<LiveEvents[]>([])
    const [upcomingEvents, setUpcomingEvents] = useState<TodayEvent[]>([])
    const [pastEvents, setPastEvents] = useState<TodayEvent[]>([])


    useEffect(() => {
        getLiveGames().then(response => {
            setLiveEvents(response.data.data.schedule.events.filter(filterByTeams))
        }).catch(() => {})

        getSchedule().then(response => {
            const allEvents = response.data.data.schedule.events.filter(filterByValidEvent);
            const now = getCurrentUTCTime();
            const { upcoming, past } = filterGamesByTimeWindow<TodayEvent>(allEvents, now);
            
            setUpcomingEvents(upcoming);
            setPastEvents(past);
        }).catch(() => {})
    }, [])

    document.title = "LoL Live Esports";

    return (
        <div className="orders-container">
            <GameCardList
                liveGames={liveEvents}
                upcomingGames={upcomingEvents}
                pastGames={pastEvents}
            />
        </div>
    );
}

function filterByTeams(event: LiveEvents) {
    return event.match !== undefined;
}

function filterByValidEvent(event: TodayEvent) {
    // Filter out events without proper match data
    if(event.match === undefined) return false
    if(event.match.id === undefined) return false
    
    return true;
}
