const FRAMES_PER_PAGE = 50;
const RETRY_DELAY_MILLIS = 2000;
const SNAKE_MIN_DELAY_MILLIS = 100;

export function getFrames(baseUrl, gameId, offset, limit) {
  const url = join(baseUrl, `/games/${gameId}/frames`);
  return get(url, { offset, limit });
}

function join(a, b) {
  return a.replace(/\/+$/, "") + "/" + b.replace(/^\/+/, "");
}

function makeQueryString(query) {
  if (!query) {
    return "";
  }

  let sep = "?";
  let result = "";

  for (const key in query) {
    const value = query[key];
    result += sep + key;

    if (value !== undefined) {
      result += "=" + value;
    }

    sep = "&";
  }

  return result;
}

async function get(url, query) {
  const fetchResult = await fetch(url + makeQueryString(query));
  return fetchResult.json();
}

function oneLeft(snakes) {
  const alive = snakes.filter(s => !s.Death);
  return alive.length <= 1;
}

function isLastFrameOfGame(game, frame) {
  if (!frame) {
    return false;
  }

  if (frame.Snakes.length === 0) {
    return true;
  }

  if (frame.Snakes.length === 1) {
    return !!frame.Snakes[0].Death;
  }

  return oneLeft(frame.Snakes);
}

async function readFramePages(game, baseUrl, receiveFrame, offset) {
  const id = game.Game.ID;
  const res = await getFrames(baseUrl, id, offset, FRAMES_PER_PAGE);
  res.Frames = res.Frames || [];

  for (const frame of res.Frames) {
    receiveFrame(game, frame);
  }

  const lastFrameOfPage = res.Frames[res.Frames.length - 1];
  if (isLastFrameOfGame(game, lastFrameOfPage)) {
    return;
  }

  const nextOffset = res.Frames.length + offset;

  // Wait for a bit if last call was empty and game is still going so
  // we don't DOS the engine API.
  const delayMillis = res.Frames.length ? 0 : RETRY_DELAY_MILLIS;
  await delay(delayMillis);
  await readFramePages(game, baseUrl, receiveFrame, nextOffset);
}

function delay(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

export function getGameInfo(baseUrl, gameId) {
  const url = join(baseUrl, `games/${gameId}`);
  return get(url);
}

export async function readAllFrames(baseUrl, gameId, receiveFrame) {
  let chain = Promise.resolve();

  function onFrame(g, f) {
    chain = chain.then(async () => {
      await delay(SNAKE_MIN_DELAY_MILLIS);
      receiveFrame(g, f);
    });
  }

  const g = await getGameInfo(baseUrl, gameId);
  return await readFramePages(g, baseUrl, onFrame, 0);
}
