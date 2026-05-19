import axios from "axios";

export const ITEMS_URL = "https://ddragon.leagueoflegends.com/cdn/16.10.1/img/item/"
//export const ITEMS_URL = "https://ddragon.bangingheads.net/cdn/latest/img/item/"
//export const CHAMPIONS_URL = "https://ddragon.bangingheads.net/cdn/latest/img/champion/"
export const CHAMPIONS_URL = "https://ddragon.leagueoflegends.com/cdn/16.10.1/img/champion/"

const API_URL_PERSISTED = "https://esports-api.lolesports.com/persisted/gw"
const API_URL_LIVE = "https://feed.lolesports.com/livestats/v1"
const API_KEY = import.meta.env.VITE_LOL_API_KEY || "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"

/**
 * Validates that a game ID is a valid format (numeric string)
 * @param gameId - The game ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidGameId(gameId: string): boolean {
    // Game IDs from Riot API are numeric strings
    return /^\d+$/.test(gameId) && gameId.length > 0 && gameId.length <= 20
}

/**
 * Validates ISO date format
 * @param date - The date string to validate
 * @returns true if valid ISO date format, false otherwise
 */
export function isValidISODate(date: string): boolean {
    // Basic ISO 8601 format validation
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
    return isoRegex.test(date)
}

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

export function getLiveWindowGame(gameId: string, date?: string, signal?: AbortSignal) {
    if (!isValidGameId(gameId)) {
        return Promise.reject(new Error('Invalid game ID format'))
    }

    const params: Record<string, string> = {
        "hl": "en-US",
    };

    if (date) {
        if (!isValidISODate(date)) {
            return Promise.reject(new Error('Invalid date format'))
        }
        params["startingTime"] = date;
    }

    return axios.get(`${API_URL_LIVE}/window/${gameId}`, {
        params,
        headers: {
            "x-api-key": API_KEY,
        },
        signal,
    })
}

export function getLiveDetailsGame(gameId: string, date: string, signal?: AbortSignal) {
    if (!isValidGameId(gameId)) {
        return Promise.reject(new Error('Invalid game ID format'))
    }

    if (!isValidISODate(date)) {
        return Promise.reject(new Error('Invalid date format'))
    }

    return axios.get(`${API_URL_LIVE}/details/${gameId}`, {
        params: {
            "hl": "en-US",
            "startingTime": date,
        },
        headers: {
            "x-api-key": API_KEY,
        },
        signal,
    })
}

export function getGameDetails(gameId: string) {
    if (!isValidGameId(gameId)) {
        return Promise.reject(new Error('Invalid game ID format'))
    }

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
