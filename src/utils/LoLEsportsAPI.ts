import axios from "axios";

export const ITEMS_URL = "https://ddragon.leagueoflegends.com/cdn/15.20.1/img/item/"
//export const ITEMS_URL = "https://ddragon.bangingheads.net/cdn/latest/img/item/"
//export const CHAMPIONS_URL = "https://ddragon.bangingheads.net/cdn/latest/img/champion/"
export const CHAMPIONS_URL = "https://ddragon.leagueoflegends.com/cdn/15.20.1/img/champion/"

const API_URL_PERSISTED = "https://esports-api.lolesports.com/persisted/gw"
const API_URL_LIVE = "https://feed.lolesports.com/livestats/v1"
const API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"

export function getLiveGames() {
    return axios.get(`${API_URL_PERSISTED}/getLive?hl=en-US`, {
        headers: {
            "x-api-key": API_KEY,
        },
    })
}

export function getSchedule() {
    return axios.get(`${API_URL_PERSISTED}/getSchedule?hl=en-US`, {
        headers: {
            "x-api-key": API_KEY,
        },
    })
}

export function getLiveWindowGame(gameId: string, date?: string) {
    const params: Record<string, string> = {
        "hl": "en-US",
    };

    if (date) {
        params["startingTime"] = date;
    }

    return axios.get(`${API_URL_LIVE}/window/${gameId}`, {
        params,
        headers: {
            "x-api-key": API_KEY,
        },
    })
}

export function getLiveDetailsGame(gameId: string, date: string) {
    return axios.get(`${API_URL_LIVE}/details/${gameId}`, {
        params: {
            "hl": "en-US",
            "startingTime": date,
        },
        headers: {
            "x-api-key": API_KEY,
        },
    })
}

export function getGameDetails(gameId: string) {
    return axios.get(`${API_URL_PERSISTED}/getEventDetails`, {
        params: {
            "hl": "en-US",
            "id": gameId,
        },
        headers: {
            "x-api-key": API_KEY,
        },
    })
}


export function getISODateMultiplyOf10() {
    const date = new Date();
    date.setMilliseconds(0);
  
    if (date.getSeconds() % 10 !== 0) {
      date.setSeconds(date.getSeconds() - (date.getSeconds() % 10));
    }
  
    date.setSeconds(date.getSeconds() - 60);
  
    // Ensure the ISO string has .000Z at the end
    const isoString = date.toISOString();
    return isoString.replace(/\.\d+Z$/, '.000Z');
}
