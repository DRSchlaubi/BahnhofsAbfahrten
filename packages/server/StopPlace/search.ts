import { byEva, byName, byPosition, byRl100, groups, keys } from 'business-hub';
import { CacheDatabases, createNewCache } from 'server/cache';
import { getSingleStation } from 'server/iris/station';
import { manualNameOverrides } from 'server/StopPlace/manualNameOverrides';
import { searchWithHafas } from 'server/StopPlace/hafasSearch';
import { StopPlaceKeyType } from 'business-hub/types';
import type { GroupedStopPlace, StopPlaceIdentifier } from 'types/stopPlace';
import type {
  ResolvedStopPlaceGroups,
  StopPlace,
  StopPlaceSearchResult,
} from 'business-hub/types';

const stopPlaceStationSearchCache = createNewCache<string, GroupedStopPlace[]>(
  CacheDatabases.StopPlaceSearch,
);
const stopPlaceSalesSearchCache = createNewCache<string, GroupedStopPlace[]>(
  CacheDatabases.StopPlaceSalesSearch,
);
const stopPlaceGeoCache = createNewCache<string, GroupedStopPlace[]>(
  CacheDatabases.StopPlaceGeo,
);
const stopPlaceIdentifierCache = createNewCache<
  string,
  StopPlaceIdentifier | undefined
>(CacheDatabases.StopPlaceIdentifier);
const stopPlaceByRilCache = createNewCache<string, StopPlace>(
  CacheDatabases.StopPlaceByRil,
);
const stopPlaceByEvaCache = createNewCache<string, GroupedStopPlace>(
  CacheDatabases.StopPlaceByEva,
);
const stopPlaceGroupCache = createNewCache<string, ResolvedStopPlaceGroups>(
  CacheDatabases.StopPlaceGroups,
);

function mapToGroupedStopPlace(
  stopPlace: Pick<
    StopPlaceSearchResult,
    'evaNumber' | 'names' | 'availableTransports' | 'position'
  >,
): GroupedStopPlace {
  return {
    evaNumber: stopPlace.evaNumber,
    name: stopPlace.names.DE.nameLong,
    availableTransports: stopPlace.availableTransports,
    position: stopPlace.position,
  };
}

export async function irisFilter(
  stopPlaces: GroupedStopPlace[],
): Promise<GroupedStopPlace[]> {
  return (
    await Promise.all(
      stopPlaces.map(async (stopPlace) => {
        try {
          await getSingleStation(stopPlace.evaNumber);
          return stopPlace;
        } catch {
          return undefined;
        }
      }),
    )
  ).filter(Boolean);
}

export async function searchStopPlace(
  searchTerm?: string,
  max?: number,
  filterForIris?: boolean,
  groupBySales?: boolean,
): Promise<GroupedStopPlace[]> {
  try {
    return await searchStopPlaceRisStations(
      searchTerm,
      max,
      filterForIris,
      groupBySales,
    );
  } catch (e) {
    // debug this shit
    // eslint-disable-next-line no-console
    console.error(e);
    return searchWithHafas(searchTerm, max, filterForIris);
  }
}

export async function searchStopPlaceRisStations(
  searchTerm?: string,
  max?: number,
  filterForIris?: boolean,
  groupBySales?: boolean,
): Promise<GroupedStopPlace[]> {
  if (!searchTerm) return [];

  searchTerm = manualNameOverrides.get(searchTerm.toLowerCase()) || searchTerm;

  const searchCache = groupBySales
    ? stopPlaceSalesSearchCache
    : stopPlaceStationSearchCache;

  let groupedStopPlaces =
    (await searchCache.get(searchTerm)) ||
    (await searchStopPlaceRemote(searchTerm, groupBySales));

  if (filterForIris) {
    groupedStopPlaces = await irisFilter(groupedStopPlaces);
  }

  if (max) {
    return groupedStopPlaces.splice(0, max);
  }

  return groupedStopPlaces;
}

export async function getStopPlaceByEva(
  evaNumber: string,
): Promise<GroupedStopPlace | undefined> {
  const cached = await stopPlaceByEvaCache.get(evaNumber);
  if (cached) return cached;
  const risResult = await byEva(evaNumber);
  if (risResult) {
    const groupedStopPlace = mapToGroupedStopPlace(risResult);
    void stopPlaceByEvaCache.set(groupedStopPlace.evaNumber, groupedStopPlace);
    return groupedStopPlace;
  }
}

export async function geoSearchStopPlace(
  lat: number,
  lng: number,
  radius: number,
  max?: number,
  filterForIris?: boolean,
): Promise<GroupedStopPlace[]> {
  const cacheKey = `${lat}_${lng}_${radius}`;

  let groupedStopPlaces =
    (await stopPlaceGeoCache.get(cacheKey)) ||
    (await geoSearchStopPlaceRemote(lat, lng, radius));

  if (filterForIris) {
    groupedStopPlaces = await irisFilter(groupedStopPlaces);
  }

  if (max) {
    return groupedStopPlaces.splice(0, max);
  }

  return groupedStopPlaces;
}

async function geoSearchStopPlaceRemote(
  lat: number,
  lng: number,
  radius: number,
) {
  const cacheKey = `${lat}_${lng}_${radius}`;
  const result = (await byPosition(lat, lng, radius, true))
    .map(mapToGroupedStopPlace)
    .filter((s) => s.availableTransports.length);
  await addIdentifiers(result);

  void stopPlaceGeoCache.set(cacheKey, result);
  result.forEach((s) => {
    void stopPlaceByEvaCache.set(s.evaNumber, s);
  });
  return result;
}

export async function byRl100WithSpaceHandling(
  rl100: string,
): Promise<StopPlace | undefined> {
  if (rl100.length > 5) {
    return Promise.resolve(undefined);
  }
  const cached = await stopPlaceByRilCache.get(rl100);
  if (cached) {
    return cached;
  }
  const rl100Promise = byRl100(rl100.toUpperCase());
  let rl100DoubleSpacePromise: typeof rl100Promise = Promise.resolve(undefined);
  if (rl100.length < 5 && rl100.includes(' ')) {
    rl100DoubleSpacePromise = byRl100(rl100.replace(/ /g, '  ').toUpperCase());
  }
  const result = (await rl100Promise) || (await rl100DoubleSpacePromise);
  if (result) {
    void stopPlaceByRilCache.set(rl100, result);
  }
  return result;
}

async function searchStopPlaceRemote(
  searchTerm: string,
  groupBySales?: boolean,
) {
  const [risResult, rl100Result] = await Promise.all([
    byName(searchTerm, undefined, groupBySales),
    byRl100WithSpaceHandling(searchTerm.toUpperCase()),
  ]);
  const groupedStopPlaces = risResult.map(mapToGroupedStopPlace);
  if (rl100Result) {
    groupedStopPlaces.unshift(mapToGroupedStopPlace(rl100Result));
    if (groupedStopPlaces[1]?.name.toLowerCase() === searchTerm.toLowerCase()) {
      const [rl100, directMatch] = groupedStopPlaces;
      groupedStopPlaces[0] = directMatch;
      groupedStopPlaces[1] = rl100;
    }
  }
  await addIdentifiers(groupedStopPlaces);

  const searchCache = groupBySales
    ? stopPlaceSalesSearchCache
    : stopPlaceStationSearchCache;

  void searchCache.set(searchTerm, groupedStopPlaces);
  groupedStopPlaces.forEach((s) => {
    void stopPlaceByEvaCache.set(s.evaNumber, s);
  });
  return groupedStopPlaces;
}

async function addIdentifiers(stopPlaces: GroupedStopPlace[]): Promise<void> {
  await Promise.all(
    stopPlaces.map(async (stopPlace) => {
      stopPlace.identifier = await getIdentifiers(stopPlace.evaNumber);
    }),
  );
}

export async function getIdentifiers(
  evaNumber: string,
): Promise<StopPlaceIdentifier | undefined> {
  const cached = await stopPlaceIdentifierCache.get(evaNumber);
  if (cached) return Object.values(cached).length > 0 ? cached : undefined;
  const identifier: StopPlaceIdentifier = {
    evaNumber,
  };
  try {
    const stopPlaceKeys = await keys(evaNumber);
    stopPlaceKeys.forEach(({ type, key }) => {
      switch (type) {
        case StopPlaceKeyType.Ifopt:
          identifier.ifopt = key;
          break;
        case StopPlaceKeyType.Rl100:
          identifier.ril100 = key;
          break;
        case StopPlaceKeyType.Rl100Alternative:
          if (!identifier.alternativeRil100) {
            identifier.alternativeRil100 = [];
          }
          identifier.alternativeRil100.push(key);
          break;
        case StopPlaceKeyType.Stada:
          identifier.stationId = key;
          break;
      }
    });
    void stopPlaceIdentifierCache.set(evaNumber, identifier);
    if (Object.keys(identifier).length > 0) {
      return identifier;
    }
  } catch {
    // Failed, guess no identifier
  }

  return undefined;
}

export function getGroups(evaNumber: string): Promise<ResolvedStopPlaceGroups> {
  return stopPlaceGroupCache.wrap(evaNumber, () => groups(evaNumber));
}
