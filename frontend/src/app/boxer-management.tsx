import { API_BASE_URL } from '../constants/api';
import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import {
  saveTournament,
} from '../constants/storage';

import {
  parseExtractedTournamentPdf,
  BoxerRegistryItem,
  getTournamentImportSummary,
} from '../utils/tournament-pdf-parser';

import PdfTextExtractor, {
  PdfTextExtractorHandle,
} from '../components/PdfTextExtractor';



const AUTH_TOKEN_KEY =
  '@boxing_auth_token';

const TOURNAMENT_BOXER_IDS_KEY =
  '@boxing_tournament_boxer_ids';

type BoxerStatus =
  | 'ACTIVE'
  | 'INACTIVE';

type Boxer = {
  id: string;
  boxerId: string;
  name: string;
  dateOfBirth: string;
  weight: string;
  club: string;
  coach: string;
  stance: string;
  status: BoxerStatus;
};

type BoxerViewMode =
  | 'GENERAL'
  | 'TOURNAMENT'
  | 'ALL';

export default function BoxerManagementScreen() {
  const { editId } =
    useLocalSearchParams<{
      editId?: string;
    }>();

  const pdfExtractorRef =
    useRef<PdfTextExtractorHandle>(null);

  const [boxers, setBoxers] =
    useState<Boxer[]>([]);

  const [tournamentBoxerIds, setTournamentBoxerIds] =
    useState<string[]>([]);

  const [boxerViewMode, setBoxerViewMode] =
    useState<BoxerViewMode>('GENERAL');

  const [search, setSearch] =
    useState('');

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [editingBoxer, setEditingBoxer] =
    useState<Boxer | null>(null);

  const [name, setName] =
    useState('');

  const [dateOfBirth, setDateOfBirth] =
    useState('');

  const [weight, setWeight] =
    useState('');

  const [club, setClub] =
    useState('');

  const [coach, setCoach] =
    useState('');

  const [stance, setStance] =
    useState('ORTHODOX');

  const [selectedPdfName, setSelectedPdfName] =
    useState('');

  const [selectedPdfUri, setSelectedPdfUri] =
    useState('');

  const [
    showTournamentNameModal,
    setShowTournamentNameModal,
  ] = useState(false);

  const [tournamentName, setTournamentName] =
    useState('');

  const [pendingPdfName, setPendingPdfName] =
    useState('');

  const [pendingPdfUri, setPendingPdfUri] =
    useState('');

  const [
    isImportingTournament,
    setIsImportingTournament,
  ] = useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  /*
   * =========================================================
   * INITIAL LOAD
   * =========================================================
   */

  useEffect(() => {
    void loadTournamentBoxerIds();
    void loadBoxers();
  }, []);

  useEffect(() => {
    if (
      !editId ||
      boxers.length === 0
    ) {
      return;
    }

    const boxerToEdit =
      boxers.find(
        (
          boxer: Boxer,
        ): boolean =>
          boxer.id === editId,
      );

    if (boxerToEdit) {
      openEditModal(
        boxerToEdit,
      );
    }
  }, [
    editId,
    boxers,
  ]);

  /*
   * =========================================================
   * TOURNAMENT-ONLY BOXER STORAGE
   * =========================================================
   *
   * Tournament boxers are NOT deleted from PostgreSQL.
   *
   * Their IDs are stored locally so Boxer Management can
   * distinguish them from normal/general boxers.
   */

  const loadTournamentBoxerIds =
    async (): Promise<void> => {
      try {
        const stored =
          await AsyncStorage.getItem(
            TOURNAMENT_BOXER_IDS_KEY,
          );

        if (!stored) {
          setTournamentBoxerIds(
            [],
          );

          return;
        }

        const parsed: unknown =
          JSON.parse(
            stored,
          );

        if (
          Array.isArray(
            parsed,
          )
        ) {
          const validIds =
            parsed.filter(
              (
                value: unknown,
              ): value is string =>
                typeof value ===
                  'string' &&
                value.trim()
                  .length > 0,
            );

          setTournamentBoxerIds(
            Array.from(
              new Set(
                validIds,
              ),
            ),
          );
        } else {
          setTournamentBoxerIds(
            [],
          );
        }
      } catch (error) {
        console.log(
          'Error loading tournament boxer IDs:',
          error,
        );

        setTournamentBoxerIds(
          [],
        );
      }
    };

  const addTournamentBoxerIds =
    async (
      ids: string[],
    ): Promise<void> => {
      if (
        ids.length === 0
      ) {
        return;
      }

      try {
        const existing =
          await AsyncStorage.getItem(
            TOURNAMENT_BOXER_IDS_KEY,
          );

        let existingIds: string[] =
          [];

        if (existing) {
          const parsed: unknown =
            JSON.parse(
              existing,
            );

          if (
            Array.isArray(
              parsed,
            )
          ) {
            existingIds =
              parsed.filter(
                (
                  value: unknown,
                ): value is string =>
                  typeof value ===
                    'string' &&
                  value.trim()
                    .length > 0,
              );
          }
        }

        const mergedIds =
          Array.from(
            new Set([
              ...existingIds,
              ...ids,
            ]),
          );

        await AsyncStorage.setItem(
          TOURNAMENT_BOXER_IDS_KEY,
          JSON.stringify(
            mergedIds,
          ),
        );

        setTournamentBoxerIds(
          mergedIds,
        );
      } catch (error) {
        console.log(
          'Error saving tournament boxer IDs:',
          error,
        );
      }
    };

  /*
   * Older imported tournament boxers may not exist in the
   * AsyncStorage list because they were imported before this
   * separation system was introduced.
   *
   * They were created using these temporary values.
   */

  const isLegacyTournamentBoxer = (
    boxer: Boxer,
  ): boolean => {
    const coach =
      boxer.coach
        .trim()
        .toUpperCase();

    return (
      coach ===
        'UNKNOWN - UPDATE PROFILE' ||
      boxer.dateOfBirth ===
        '01/01/2000'
    );
  };

  const isTournamentBoxer = (
    boxer: Boxer,
  ): boolean => {
    return (
      tournamentBoxerIds.includes(
        boxer.id,
      ) ||
      isLegacyTournamentBoxer(
        boxer,
      )
    );
  };

  /*
   * =========================================================
   * AUTHENTICATION
   * =========================================================
   */

  const getAuthToken =
    async (): Promise<
      string | null
    > => {
      return AsyncStorage.getItem(
        AUTH_TOKEN_KEY,
      );
    };

  const authenticatedRequest =
    async (
      endpoint: string,
      options: RequestInit = {},
    ): Promise<any> => {
      const token =
        await getAuthToken();

      if (!token) {
        throw new Error(
          'Your login session has expired. Please login again.',
        );
      }

      const headers: Record<
        string,
        string
      > = {
        'Content-Type':
          'application/json',
        Authorization:
          `Bearer ${token}`,
        ...(
          (options.headers ??
            {}) as Record<
            string,
            string
          >
        ),
      };

      const response =
        await fetch(
          `${API_BASE_URL}${endpoint}`,
          {
            ...options,
            headers,
          },
        );

      let data: any =
        null;

      try {
        const contentType =
          response.headers.get(
            'content-type',
          ) || '';

        if (
          contentType
            .toLowerCase()
            .includes(
              'application/json',
            )
        ) {
          data =
            await response.json();
        } else {
          const text =
            await response.text();

          data = text
            ? {
                message: text,
              }
            : null;
        }
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            'The server could not complete the request.',
        );
      }

      return data;
    };

  /*
   * =========================================================
   * BACKEND BOXER MAPPING
   * =========================================================
   */

  const mapBackendBoxer = (
    boxer: any,
  ): Boxer => {
    const numericWeight =
      Number(
        boxer.weight,
      );

    return {
      id: String(
        boxer.id ??
          '',
      ),

      boxerId: String(
        boxer.boxerId ??
          boxer.id ??
          '',
      ),

      name: String(
        boxer.name ??
          '',
      ),

      dateOfBirth:
        boxer.dateOfBirth
          ? formatDateForDisplay(
              String(
                boxer.dateOfBirth,
              ),
            )
          : '',

      weight:
        Number.isFinite(
          numericWeight,
        )
          ? `${numericWeight} KG`
          : String(
              boxer.weight ??
                '',
            ),

      club: String(
        boxer.club ??
          '',
      ),

      coach: String(
        boxer.coach ??
          '',
      ),

      stance: String(
        boxer.stance ??
          'ORTHODOX',
      ),

      status:
        boxer.status ===
        'INACTIVE'
          ? 'INACTIVE'
          : 'ACTIVE',
    };
  };

  /*
   * =========================================================
   * LOAD BOXERS
   * =========================================================
   */

  const loadBoxers =
    async (): Promise<void> => {
      setIsLoading(
        true,
      );

      try {
        const data =
          await authenticatedRequest(
            '/boxers',
          );

        const backendBoxers =
          Array.isArray(
            data?.boxers,
          )
            ? data.boxers
            : Array.isArray(
                data?.data,
              )
            ? data.data
            : Array.isArray(
                data,
              )
            ? data
            : [];

        const mappedBoxers: Boxer[] =
          backendBoxers.map(
            (
              item: any,
            ): Boxer =>
              mapBackendBoxer(
                item,
              ),
          );

        setBoxers(
          mappedBoxers,
        );
      } catch (error) {
        console.log(
          'Error loading boxers:',
          error,
        );

        Alert.alert(
          'Unable to Load Boxers',
          error instanceof Error
            ? error.message
            : 'Could not load boxers from the server.',
        );

        setBoxers(
          [],
        );
      } finally {
        setIsLoading(
          false,
        );
      }
    };

  /*
   * =========================================================
   * FORM HELPERS
   * =========================================================
   */

  const parseWeight = (
    value: string,
  ): number | null => {
    const cleaned =
      value
        .replace(
          /kg/gi,
          '',
        )
        .trim();

    const numeric =
      Number(
        cleaned,
      );

    if (
      !Number.isFinite(
        numeric,
      ) ||
      numeric <= 0
    ) {
      return null;
    }

    return numeric;
  };

  const convertDateToIso = (
    value: string,
  ): string | null => {
    const trimmed =
      value.trim();

    const match =
      trimmed.match(
        /^(\d{2})\/(\d{2})\/(\d{4})$/,
      );

    if (!match) {
      return null;
    }

    const day =
      Number(
        match[1],
      );

    const month =
      Number(
        match[2],
      );

    const year =
      Number(
        match[3],
      );

    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day,
        ),
      );

    if (
      date.getUTCFullYear() !==
        year ||
      date.getUTCMonth() !==
        month - 1 ||
      date.getUTCDate() !==
        day
    ) {
      return null;
    }

    return date.toISOString();
  };

  const buildBoxerPayload =
    () => {
      const parsedWeight =
        parseWeight(
          weight,
        );

      if (
        parsedWeight ===
        null
      ) {
        Alert.alert(
          'Invalid Weight',
          'Please enter a valid numeric weight such as 60 KG.',
        );

        return null;
      }

      const isoDate =
        convertDateToIso(
          dateOfBirth,
        );

      if (!isoDate) {
        Alert.alert(
          'Invalid Date of Birth',
          'Please enter the date as DD/MM/YYYY.',
        );

        return null;
      }

      if (
        !name.trim() ||
        !club.trim() ||
        !coach.trim()
      ) {
        Alert.alert(
          'Missing Information',
          'Please fill in all boxer details.',
        );

        return null;
      }

      return {
        name:
          name.trim(),

        dateOfBirth:
          isoDate,

        weight:
          parsedWeight,

        club:
          club.trim(),

        coach:
          coach.trim(),

        stance,

        status:
          'ACTIVE',
      };
    };

  /*
   * =========================================================
   * SAVE / UPDATE BOXER
   * =========================================================
   */

  const handleSaveBoxer =
    async (): Promise<void> => {
      const payload =
        buildBoxerPayload();

      if (!payload) {
        return;
      }

      setIsSaving(
        true,
      );

      try {
        if (
          editingBoxer
        ) {
          const data =
            await authenticatedRequest(
              `/boxers/${encodeURIComponent(
                editingBoxer.id,
              )}`,
              {
                method:
                  'PUT',
                body:
                  JSON.stringify(
                    payload,
                  ),
              },
            );

          const updatedBoxer =
            data?.boxer ??
            data?.data;

          if (
            updatedBoxer
          ) {
            setBoxers(
              (
                current: Boxer[],
              ): Boxer[] =>
                current.map(
                  (
                    boxer: Boxer,
                  ): Boxer =>
                    boxer.id ===
                    editingBoxer.id
                      ? mapBackendBoxer(
                          updatedBoxer,
                        )
                      : boxer,
                ),
            );
          } else {
            await loadBoxers();
          }

          const updatedName =
            name.trim();

          closeModal();

          Alert.alert(
            'Boxer Updated',
            `${updatedName}'s information has been updated successfully.`,
          );
        } else {
          const data =
            await authenticatedRequest(
              '/boxers',
              {
                method:
                  'POST',
                body:
                  JSON.stringify(
                    payload,
                  ),
              },
            );

          const createdBoxer =
            data?.boxer ??
            data?.data;

          if (
            createdBoxer
          ) {
            const mapped =
              mapBackendBoxer(
                createdBoxer,
              );

            setBoxers(
              (
                current: Boxer[],
              ): Boxer[] => [
                mapped,
                ...current,
              ],
            );
          } else {
            await loadBoxers();
          }

          closeModal();

          const createdId =
            createdBoxer?.boxerId ??
            createdBoxer?.id ??
            'new boxer';

          Alert.alert(
            'Boxer Registered',
            `${name.trim()} has been registered successfully as ${createdId}.`,
          );
        }
      } catch (error) {
        console.log(
          'Error saving boxer:',
          error,
        );

        Alert.alert(
          'Unable to Save Boxer',
          error instanceof Error
            ? error.message
            : 'The boxer could not be saved.',
        );
      } finally {
        setIsSaving(
          false,
        );
      }
    };

  /*
   * =========================================================
   * STATUS
   * =========================================================
   */

  const toggleStatus = (
    boxer: Boxer,
  ): void => {
    const newStatus: BoxerStatus =
      boxer.status ===
      'ACTIVE'
        ? 'INACTIVE'
        : 'ACTIVE';

    Alert.alert(
      newStatus ===
        'ACTIVE'
        ? 'Activate Boxer'
        : 'Deactivate Boxer',

      `Are you sure you want to ${
        newStatus ===
        'ACTIVE'
          ? 'activate'
          : 'deactivate'
      } ${boxer.name}?`,

      [
        {
          text:
            'Cancel',

          style:
            'cancel',
        },

        {
          text:
            newStatus ===
            'ACTIVE'
              ? 'Activate'
              : 'Deactivate',

          onPress:
            async (): Promise<void> => {
              try {
                await authenticatedRequest(
                  `/boxers/${encodeURIComponent(
                    boxer.id,
                  )}`,
                  {
                    method:
                      'PUT',

                    body:
                      JSON.stringify({
                        status:
                          newStatus,
                      }),
                  },
                );

                setBoxers(
                  (
                    current: Boxer[],
                  ): Boxer[] =>
                    current.map(
                      (
                        item: Boxer,
                      ): Boxer =>
                        item.id ===
                        boxer.id
                          ? {
                              ...item,
                              status:
                                newStatus,
                            }
                          : item,
                    ),
                );
              } catch (error) {
                console.log(
                  'Error updating boxer status:',
                  error,
                );

                Alert.alert(
                  'Unable to Update Boxer',
                  error instanceof Error
                    ? error.message
                    : 'The boxer status could not be updated.',
                );
              }
            },
        },
      ],
    );
  };

  /*
   * =========================================================
   * MODALS
   * =========================================================
   */

  const resetForm =
    (): void => {
      setName('');
      setDateOfBirth('');
      setWeight('');
      setClub('');
      setCoach('');
      setStance(
        'ORTHODOX',
      );
      setEditingBoxer(
        null,
      );
    };

  const openAddModal =
    (): void => {
      resetForm();
      setShowAddModal(
        true,
      );
    };

  const openEditModal = (
    boxer: Boxer,
  ): void => {
    setEditingBoxer(
      boxer,
    );

    setName(
      boxer.name,
    );

    setDateOfBirth(
      boxer.dateOfBirth,
    );

    setWeight(
      boxer.weight,
    );

    setClub(
      boxer.club,
    );

    setCoach(
      boxer.coach,
    );

    setStance(
      boxer.stance,
    );

    setShowAddModal(
      true,
    );
  };

  const closeModal =
    (): void => {
      if (isSaving) {
        return;
      }

      Keyboard.dismiss();

      resetForm();

      setShowAddModal(
        false,
      );
    };

  const closeTournamentNameModal =
    (): void => {
      Keyboard.dismiss();

      if (
        isImportingTournament
      ) {
        return;
      }

      setShowTournamentNameModal(
        false,
      );

      setPendingPdfName(
        '',
      );

      setPendingPdfUri(
        '',
      );

      setTournamentName(
        '',
      );
    };

  /*
   * =========================================================
   * TOURNAMENT PDF HELPERS
   * =========================================================
   */

  const normalizeImportedName =
    (
      value: string,
    ): string =>
      value
        .trim()
        .replace(
          /\s+/g,
          ' ',
        )
        .replace(
          /[.,]/g,
          '',
        )
        .toUpperCase();

  const getImportedWeightNumber =
    (
      value: string,
    ): number => {
      const match =
        value.match(
          /\d+(?:\.\d+)?/,
        );

      const number =
        match
          ? Number(
              match[0],
            )
          : 0;

      return Number.isFinite(
        number,
      ) &&
        number > 0
        ? number
        : 1;
    };

  /*
   * Automatically register missing boxers from the PDF.
   *
   * IMPORTANT:
   * Their PostgreSQL records remain available.
   * Only their Boxer Management classification changes.
   */

  const registerMissingTournamentBoxers =
    async (
      tournament: Awaited<
        ReturnType<
          typeof parseExtractedTournamentPdf
        >
      >,
    ) => {
      const importedBoxers =
        new Map<
          string,
          {
            name: string;
            club: string;
            weight: string;
          }
        >();

      for (const category of
        tournament.weightCategories) {
        for (const match of
          category.matches) {
          const candidates = [
            {
              name:
                match.redBoxer,

              club:
                match.redClub,
            },

            {
              name:
                match.blueBoxer,

              club:
                match.blueClub,
            },
          ];

          for (const candidate of
            candidates) {
            if (
              !candidate.name
            ) {
              continue;
            }

            const normalized =
              normalizeImportedName(
                candidate.name,
              );

            if (
              !normalized ||
              importedBoxers.has(
                normalized,
              )
            ) {
              continue;
            }

            importedBoxers.set(
              normalized,
              {
                name:
                  candidate.name.trim(),

                club:
                  candidate.club?.trim() ||
                  'UNKNOWN CLUB',

                weight:
                  match.weightCategory ||
                  '',
              },
            );
          }
        }
      }

      const currentByName =
        new Map<
          string,
          Boxer
        >(
          boxers.map(
            (
              boxer: Boxer,
            ): [
              string,
              Boxer,
            ] => [
              normalizeImportedName(
                boxer.name,
              ),
              boxer,
            ],
          ),
        );

      const resolvedBoxerIds: string[] =
        [];

      const newlyRegistered: Boxer[] =
        [];

      for (const imported of
        importedBoxers.values()) {
        const existing =
          currentByName.get(
            normalizeImportedName(
              imported.name,
            ),
          );

        if (existing) {
          resolvedBoxerIds.push(
            existing.id,
          );

          continue;
        }

        const createdResponse =
          await authenticatedRequest(
            '/boxers',
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  name:
                    imported.name,

                  dateOfBirth:
                    '2000-01-01T00:00:00.000Z',

                  weight:
                    getImportedWeightNumber(
                      imported.weight,
                    ),

                  club:
                    imported.club,

                  coach:
                    'UNKNOWN - UPDATE PROFILE',

                  stance:
                    'ORTHODOX',

                  status:
                    'ACTIVE',
                }),
            },
          );

        const created =
          createdResponse?.boxer ??
          createdResponse?.data;

        if (!created) {
          throw new Error(
            `The boxer "${imported.name}" could not be registered automatically.`,
          );
        }

        const mapped =
          mapBackendBoxer(
            created,
          );

        currentByName.set(
          normalizeImportedName(
            mapped.name,
          ),
          mapped,
        );

        resolvedBoxerIds.push(
          mapped.id,
        );

        newlyRegistered.push(
          mapped,
        );
      }

      if (
        newlyRegistered.length >
        0
      ) {
        setBoxers(
          (
            current: Boxer[],
          ): Boxer[] => {
            const existingIds =
              new Set(
                current.map(
                  (
                    item: Boxer,
                  ): string =>
                    item.id,
                ),
              );

            return [
              ...newlyRegistered.filter(
                (
                  item: Boxer,
                ): boolean =>
                  !existingIds.has(
                    item.id,
                  ),
              ),
              ...current,
            ];
          },
        );

        await addTournamentBoxerIds(
          newlyRegistered.map(
            (
              boxer: Boxer,
            ): string =>
              boxer.id,
          ),
        );
      }

      const uniqueIds =
        Array.from(
          new Set(
            resolvedBoxerIds,
          ),
        );

      /*
       * Keep valid database boxer IDs attached to the
       * tournament so tournament matches can reference them.
       */
      tournament.weightCategories =
        tournament.weightCategories.map(
          (
            category,
          ) => ({
            ...category,

            boxerIds:
              uniqueIds,
          }),
        );

      return {
        tournament,

        newlyRegisteredCount:
          newlyRegistered.length,
      };
    };

  /*
   * =========================================================
   * SELECT TOURNAMENT PDF
   * =========================================================
   */

  const handleImportTournamentPdf =
    async (): Promise<void> => {
      try {
        const result =
          await DocumentPicker.getDocumentAsync(
            {
              type:
                'application/pdf',

              copyToCacheDirectory:
                true,

              multiple:
                false,
            },
          );

        if (
          result.canceled
        ) {
          return;
        }

        const selectedFile =
          result.assets?.[0];

        if (
          !selectedFile?.uri
        ) {
          Alert.alert(
            'Import Error',
            'No PDF file was selected.',
          );

          return;
        }

        setPendingPdfName(
          selectedFile.name ||
            'Tournament PDF',
        );

        setPendingPdfUri(
          selectedFile.uri,
        );

        setTournamentName(
          '',
        );

        setShowTournamentNameModal(
          true,
        );
      } catch (error) {
        console.log(
          'Error selecting tournament PDF:',
          error,
        );

        Alert.alert(
          'Import Error',
          'Unable to open the PDF picker. Please try again.',
        );
      }
    };

  /*
   * =========================================================
   * CONFIRM TOURNAMENT IMPORT
   * =========================================================
   */

  const handleConfirmTournamentImport =
    async (): Promise<void> => {
      const trimmedTournamentName =
        tournamentName.trim();

      if (
        !trimmedTournamentName
      ) {
        Alert.alert(
          'Tournament Name Required',
          'Please enter a tournament name before importing the PDF.',
        );

        return;
      }

      if (!pendingPdfUri) {
        Alert.alert(
          'PDF Missing',
          'The selected PDF could not be found. Please select it again.',
        );

        return;
      }

      if (!pendingPdfName) {
        Alert.alert(
          'PDF Name Missing',
          'The selected PDF name could not be read. Please select it again.',
        );

        return;
      }

      if (
        !pdfExtractorRef.current
      ) {
        Alert.alert(
          'PDF Extractor',
          'The PDF extractor is still loading. Please try again.',
        );

        return;
      }

      Keyboard.dismiss();

      setIsImportingTournament(
        true,
      );

      try {
        const pages =
          await pdfExtractorRef.current.extract(
            pendingPdfUri,
          );

        if (
          !pages ||
          pages.length ===
            0
        ) {
          throw new Error(
            'No readable pages were found in the PDF.',
          );
        }

        const boxerRegistry:
          BoxerRegistryItem[] =
          boxers.map(
            (
              boxer: Boxer,
            ): BoxerRegistryItem => ({
              id:
                boxer.id,

              name:
                boxer.name,

              dateOfBirth:
                boxer.dateOfBirth,

              weight:
                boxer.weight,

              club:
                boxer.club,

              coach:
                boxer.coach,

              stance:
                boxer.stance,

              status:
                boxer.status,
            }),
          );

        const tournament =
          parseExtractedTournamentPdf(
            pages,
            trimmedTournamentName,
            pendingPdfName,
            boxerRegistry,
          );

        const registrationResult =
          await registerMissingTournamentBoxers(
            tournament,
          );

        const resolvedTournament =
          registrationResult.tournament;

        /*
         * Boxer IDs are intentionally preserved here.
         * Tournament matches need the real PostgreSQL IDs.
         */
        await saveTournament(
          resolvedTournament,
        );

        const summary =
          getTournamentImportSummary(
            resolvedTournament,
          );

        setSelectedPdfName(
          pendingPdfName,
        );

        setSelectedPdfUri(
          pendingPdfUri,
        );

        setShowTournamentNameModal(
          false,
        );

        setPendingPdfName(
          '',
        );

        setPendingPdfUri(
          '',
        );

        setTournamentName(
          '',
        );

        setIsImportingTournament(
          false,
        );

        Alert.alert(
          'Tournament Created',

          `${resolvedTournament.name} has been imported successfully.\n\n` +
            `Boxers: ${summary.boxerCount}\n` +
            `Bouts: ${summary.matchCount}\n` +
            `Weight Categories: ${summary.categoryCount}` +
            (
              registrationResult.newlyRegisteredCount >
              0
                ? `\n\nAuto-registered boxers: ${registrationResult.newlyRegisteredCount}\nThey are stored in PostgreSQL for tournament/match references and hidden from the normal Boxer Registry.`
                : ''
            ),

          [
            {
              text:
                'VIEW TOURNAMENT',

              onPress:
                () => {
                  router.replace(
                    '/tournament-management',
                  );
                },
            },

            {
              text:
                'OK',

              style:
                'cancel',
            },
          ],
        );
      } catch (error) {
        console.log(
          'Error importing tournament PDF:',
          error,
        );

        setIsImportingTournament(
          false,
        );

        Alert.alert(
          'Tournament Import Failed',

          error instanceof Error
            ? error.message
            : 'The PDF could not be processed. Please make sure it is a valid tournament draw PDF.',
        );
      }
    };

  /*
   * =========================================================
   * COUNTS
   * =========================================================
   */

  const generalBoxerCount =
    boxers.filter(
      (
        boxer: Boxer,
      ): boolean =>
        !isTournamentBoxer(
          boxer,
        ),
    ).length;

  const tournamentBoxerCount =
    boxers.filter(
      (
        boxer: Boxer,
      ): boolean =>
        isTournamentBoxer(
          boxer,
        ),
    ).length;

  const allBoxerCount =
    boxers.length;

  /*
   * =========================================================
   * FILTERED BOXERS
   * =========================================================
   */

  const filteredBoxers =
    boxers.filter(
      (
        boxer: Boxer,
      ): boolean => {
        const tournamentOnly =
          isTournamentBoxer(
            boxer,
          );

        /*
         * GENERAL:
         * Only normal/manual boxers.
         */
        if (
          boxerViewMode ===
            'GENERAL' &&
          tournamentOnly
        ) {
          return false;
        }

        /*
         * TOURNAMENT:
         * Only automatically imported boxers.
         */
        if (
          boxerViewMode ===
            'TOURNAMENT' &&
          !tournamentOnly
        ) {
          return false;
        }

        const searchText =
          search
            .toLowerCase()
            .trim();

        if (
          !searchText
        ) {
          return true;
        }

        return (
          boxer.name
            .toLowerCase()
            .includes(
              searchText,
            ) ||
          boxer.boxerId
            .toLowerCase()
            .includes(
              searchText,
            ) ||
          boxer.id
            .toLowerCase()
            .includes(
              searchText,
            ) ||
          boxer.weight
            .toLowerCase()
            .includes(
              searchText,
            ) ||
          boxer.club
            .toLowerCase()
            .includes(
              searchText,
            )
        );
      },
    );

  /*
   * =========================================================
   * VIEW LABELS
   * =========================================================
   */

  const getViewTitle =
    (): string => {
      switch (
        boxerViewMode
      ) {
        case 'TOURNAMENT':
          return 'TOURNAMENT BOXERS';

        case 'ALL':
          return 'ALL BOXERS';

        default:
          return 'GENERAL BOXERS';
      }
    };

  const getViewCountLabel =
    (): string => {
      switch (
        boxerViewMode
      ) {
        case 'TOURNAMENT':
          return 'TOURNAMENT';

        case 'ALL':
          return 'TOTAL';

        default:
          return 'GENERAL';
      }
    };

  /*
   * =========================================================
   * CHANGE VIEW
   * =========================================================
   */

  const changeBoxerView =
    (
      mode: BoxerViewMode,
    ): void => {
      setBoxerViewMode(
        mode,
      );

      setSearch('');
    };

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <View
        style={
          styles.container
        }
      >

        {/* =================================================
            HEADER
            ================================================= */}

        <View
          style={
            styles.header
          }
        >
          <Pressable
            style={
              styles.backButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backArrow
              }
            >
              ‹
            </Text>
          </Pressable>

          <View
            style={
              styles.headerTitleContainer
            }
          >
            <Text
              style={
                styles.headerTitle
              }
            >
              BOXER MANAGEMENT
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              {
                getViewTitle()
              }
            </Text>
          </View>

          <View
            style={
              styles.headerCount
            }
          >
            <Text
              style={
                styles.headerCountNumber
              }
            >
              {
                filteredBoxers.length
              }
            </Text>

            <Text
              style={
                styles.headerCountLabel
              }
            >
              {
                getViewCountLabel()
              }
            </Text>
          </View>
        </View>

        {/* =================================================
            SEARCH
            ================================================= */}

        <View
          style={
            styles.searchContainer
          }
        >
          <Text
            style={
              styles.searchIcon
            }
          >
            ⌕
          </Text>

          <TextInput
            style={
              styles.searchInput
            }
            placeholder="Search boxer, ID, weight or club..."
            placeholderTextColor="#666D76"
            value={
              search
            }
            onChangeText={
              setSearch
            }
          />
        </View>

        {/* =================================================
            BOXER VIEW FILTERS
            ================================================= */}

        <View
          style={
            styles.filterContainer
          }
        >
          <Pressable
            style={[
              styles.filterButton,
              boxerViewMode ===
                'GENERAL' &&
                styles.filterButtonActive,
            ]}
            onPress={() =>
              changeBoxerView(
                'GENERAL',
              )
            }
          >
            <Text
              style={[
                styles.filterButtonText,
                boxerViewMode ===
                  'GENERAL' &&
                  styles.filterButtonTextActive,
              ]}
            >
              GENERAL
            </Text>

            <Text
              style={[
                styles.filterCount,
                boxerViewMode ===
                  'GENERAL' &&
                  styles.filterCountActive,
              ]}
            >
              {
                generalBoxerCount
              }
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterButton,
              boxerViewMode ===
                'TOURNAMENT' &&
                styles.filterButtonActive,
            ]}
            onPress={() =>
              changeBoxerView(
                'TOURNAMENT',
              )
            }
          >
            <Text
              style={[
                styles.filterButtonText,
                boxerViewMode ===
                  'TOURNAMENT' &&
                  styles.filterButtonTextActive,
              ]}
            >
              TOURNAMENT
            </Text>

            <Text
              style={[
                styles.filterCount,
                boxerViewMode ===
                  'TOURNAMENT' &&
                  styles.filterCountActive,
              ]}
            >
              {
                tournamentBoxerCount
              }
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterButton,
              boxerViewMode ===
                'ALL' &&
                styles.filterButtonActive,
            ]}
            onPress={() =>
              changeBoxerView(
                'ALL',
              )
            }
          >
            <Text
              style={[
                styles.filterButtonText,
                boxerViewMode ===
                  'ALL' &&
                  styles.filterButtonTextActive,
              ]}
            >
              ALL
            </Text>

            <Text
              style={[
                styles.filterCount,
                boxerViewMode ===
                  'ALL' &&
                  styles.filterCountActive,
              ]}
            >
              {
                allBoxerCount
              }
            </Text>
          </Pressable>
        </View>

        {/* =================================================
            IMPORT TOURNAMENT PDF
            ================================================= */}

        <Pressable
          style={({
            pressed,
          }) => [
            styles.importButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={
            handleImportTournamentPdf
          }
        >
          <View
            style={
              styles.importIconBox
            }
          >
            <Text
              style={
                styles.importIcon
              }
            >
              ↑
            </Text>
          </View>

          <View
            style={
              styles.importContent
            }
          >
            <Text
              style={
                styles.importButtonText
              }
            >
              IMPORT TOURNAMENT PDF
            </Text>

            <Text
              style={
                styles.importDescription
              }
            >
              Create a tournament from the official boxer draw
            </Text>

            {selectedPdfName ? (
              <Text
                style={
                  styles.selectedPdfText
                }
                numberOfLines={
                  1
                }
              >
                Selected:{' '}
                {
                  selectedPdfName
                }
              </Text>
            ) : null}
          </View>

          <Text
            style={
              styles.importArrow
            }
          >
            ›
          </Text>
        </Pressable>

        {/* =================================================
            REGISTER NEW BOXER
            ================================================= */}

        {boxerViewMode !==
          'TOURNAMENT' && (
          <Pressable
            style={({
              pressed,
            }) => [
              styles.addButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={
              openAddModal
            }
          >
            <Text
              style={
                styles.addIcon
              }
            >
              +
            </Text>

            <Text
              style={
                styles.addButtonText
              }
            >
              REGISTER NEW BOXER
            </Text>
          </Pressable>
        )}

        {/* =================================================
            BOXER LIST
            ================================================= */}

        <ScrollView
          style={
            styles.list
          }
          contentContainerStyle={
            styles.listContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              {
                getViewTitle()
              } REGISTRY
            </Text>

            <Text
              style={
                styles.sectionCount
              }
            >
              {
                filteredBoxers.length
              }{' '}
              RESULTS
            </Text>
          </View>

          {isLoading ? (
            <View
              style={
                styles.emptyState
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                Loading Boxers...
              </Text>
            </View>
          ) : filteredBoxers.length ===
            0 ? (
            <View
              style={
                styles.emptyState
              }
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                🥊
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                {boxerViewMode ===
                'TOURNAMENT'
                  ? 'No Tournament Boxers'
                  : boxerViewMode ===
                    'ALL'
                  ? 'No Boxers Found'
                  : 'No General Boxers Found'}
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                {boxerViewMode ===
                'TOURNAMENT'
                  ? 'Tournament-only boxers will appear here after a tournament PDF is imported.'
                  : boxerViewMode ===
                    'ALL'
                  ? 'No boxers match your current search.'
                  : 'Try another search or register a new boxer.'}
              </Text>
            </View>
          ) : (
            filteredBoxers.map(
              (
                boxer: Boxer,
              ) => (
                <View
                  key={
                    boxer.id
                  }
                  style={
                    styles.boxerCard
                  }
                >

                  {/* ===============================
                      CARD TOP
                      =============================== */}

                  <View
                    style={
                      styles.cardTop
                    }
                  >
                    <View
                      style={
                        styles.avatar
                      }
                    >
                      <Text
                        style={
                          styles.avatarText
                        }
                      >
                        {boxer.name
                          .split(
                            ' ',
                          )
                          .map(
                            (
                              part: string,
                            ) =>
                              part[0],
                          )
                          .join(
                            '',
                          )
                          .slice(
                            0,
                            2,
                          )
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.nameContainer
                      }
                    >
                      <Text
                        style={
                          styles.boxerName
                        }
                      >
                        {
                          boxer.name
                        }
                      </Text>

                      <Text
                        style={
                          styles.boxerId
                        }
                      >
                        {
                          boxer.boxerId
                        }
                      </Text>

                      {isTournamentBoxer(
                        boxer,
                      ) && (
                        <View
                          style={
                            styles.tournamentBadge
                          }
                        >
                          <Text
                            style={
                              styles.tournamentBadgeText
                            }
                          >
                            TOURNAMENT
                          </Text>
                        </View>
                      )}
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        boxer.status ===
                        'ACTIVE'
                          ? styles.activeBadge
                          : styles.inactiveBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          boxer.status ===
                          'ACTIVE'
                            ? styles.activeText
                            : styles.inactiveText,
                        ]}
                      >
                        {
                          boxer.status
                        }
                      </Text>
                    </View>
                  </View>

                  {/* ===============================
                      DETAILS
                      =============================== */}

                  <View
                    style={
                      styles.detailsGrid
                    }
                  >
                    <View
                      style={
                        styles.detailItem
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        WEIGHT
                      </Text>

                      <Text
                        style={
                          styles.detailValue
                        }
                      >
                        {
                          boxer.weight
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.detailItem
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        DOB
                      </Text>

                      <Text
                        style={
                          styles.detailValue
                        }
                      >
                        {
                          boxer.dateOfBirth
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.detailItem
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        STANCE
                      </Text>

                      <Text
                        style={
                          styles.detailValue
                        }
                      >
                        {
                          boxer.stance
                        }
                      </Text>
                    </View>
                  </View>

                  {/* ===============================
                      CLUB / COACH
                      =============================== */}

                  <View
                    style={
                      styles.clubRow
                    }
                  >
                    <View
                      style={
                        styles.clubInfo
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        CLUB
                      </Text>

                      <Text
                        style={
                          styles.clubText
                        }
                      >
                        {
                          boxer.club
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.clubInfo
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        COACH
                      </Text>

                      <Text
                        style={
                          styles.clubText
                        }
                      >
                        {
                          boxer.coach
                        }
                      </Text>
                    </View>
                  </View>

                  {/* ===============================
                      ACTIONS
                      =============================== */}

                  <View
                    style={
                      styles.actionsRow
                    }
                  >
                    <Pressable
                      style={[
                        styles.actionButton,
                        styles.viewButton,
                      ]}
                      onPress={() =>
                        Alert.alert(
                          'Boxer Profile',

                          `${boxer.name}\n\n` +
                            `ID: ${boxer.boxerId}\n` +
                            `Weight: ${boxer.weight}\n` +
                            `DOB: ${boxer.dateOfBirth}\n` +
                            `Club: ${boxer.club}\n` +
                            `Coach: ${boxer.coach}\n` +
                            `Stance: ${boxer.stance}\n` +
                            `Status: ${boxer.status}`,
                        )
                      }
                    >
                      <Text
                        style={
                          styles.viewButtonText
                        }
                      >
                        VIEW DETAILS
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.actionButton,
                        styles.editButton,
                      ]}
                      onPress={() =>
                        openEditModal(
                          boxer,
                        )
                      }
                    >
                      <Text
                        style={
                          styles.editButtonText
                        }
                      >
                        EDIT
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.actionButton,
                        styles.statusButton,
                        boxer.status ===
                        'ACTIVE'
                          ? styles.deactivateButton
                          : styles.activateButton,
                      ]}
                      onPress={() =>
                        toggleStatus(
                          boxer,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.statusButtonText,
                          boxer.status ===
                          'ACTIVE'
                            ? styles.deactivateText
                            : styles.activateText,
                        ]}
                      >
                        {boxer.status ===
                        'ACTIVE'
                          ? 'DEACTIVATE'
                          : 'ACTIVATE'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ),
            )
          )}
        </ScrollView>

        {/* =================================================
            TOURNAMENT NAME MODAL
            ================================================= */}

        <Modal
          visible={
            showTournamentNameModal
          }
          transparent
          animationType="slide"
          onRequestClose={
            closeTournamentNameModal
          }
        >
          <KeyboardAvoidingView
            style={
              styles.tournamentKeyboard
            }
            behavior={
              Platform.OS ===
              'ios'
                ? 'padding'
                : 'height'
            }
          >
            <View
              style={
                styles.modalOverlay
              }
            >
              <View
                style={
                  styles.tournamentModalCard
                }
              >
                <View
                  style={
                    styles.modalHeader
                  }
                >
                  <View
                    style={
                      styles.modalHeaderText
                    }
                  >
                    <Text
                      style={
                        styles.modalTitle
                      }
                    >
                      IMPORT TOURNAMENT
                    </Text>

                    <Text
                      style={
                        styles.modalSubtitle
                      }
                    >
                      Enter the tournament details
                    </Text>
                  </View>

                  <Pressable
                    style={
                      styles.closeButton
                    }
                    onPress={
                      closeTournamentNameModal
                    }
                    disabled={
                      isImportingTournament
                    }
                  >
                    <Text
                      style={
                        styles.closeText
                      }
                    >
                      ×
                    </Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={
                    styles.tournamentModalScroll
                  }
                  contentContainerStyle={
                    styles.tournamentModalScrollContent
                  }
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={
                    false
                  }
                >
                  <View
                    style={
                      styles.importPreviewBox
                    }
                  >
                    <Text
                      style={
                        styles.importPreviewLabel
                      }
                    >
                      SELECTED PDF
                    </Text>

                    <Text
                      style={
                        styles.importPreviewName
                      }
                    >
                      {
                        pendingPdfName
                      }
                    </Text>
                  </View>

                  <View
                    style={
                      styles.formGroup
                    }
                  >
                    <Text
                      style={
                        styles.formLabel
                      }
                    >
                      TOURNAMENT NAME
                    </Text>

                    <TextInput
                      style={
                        styles.formInput
                      }
                      placeholder="Example: Pune Boxing Championship 2026"
                      placeholderTextColor="#666D76"
                      value={
                        tournamentName
                      }
                      onChangeText={
                        setTournamentName
                      }
                      autoFocus
                      editable={
                        !isImportingTournament
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.infoBox
                    }
                  >
                    <Text
                      style={
                        styles.infoTitle
                      }
                    >
                      PDF IMPORT
                    </Text>

                    <Text
                      style={
                        styles.infoText
                      }
                    >
                      The PDF will be read and converted into a tournament bracket. Bout progression and winner references from the official draw will be preserved. Tournament-only boxers are kept in PostgreSQL for match references and hidden from the normal Boxer Registry.
                    </Text>
                  </View>

                  <Pressable
                    style={[
                      styles.saveButton,
                      isImportingTournament &&
                        styles.importingButton,
                    ]}
                    onPress={
                      handleConfirmTournamentImport
                    }
                    disabled={
                      isImportingTournament
                    }
                  >
                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      {isImportingTournament
                        ? 'IMPORTING PDF...'
                        : 'CREATE TOURNAMENT'}
                    </Text>

                    {!isImportingTournament && (
                      <Text
                        style={
                          styles.saveArrow
                        }
                      >
                        →
                      </Text>
                    )}
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* =================================================
            ADD / EDIT BOXER MODAL
            ================================================= */}

        <Modal
          visible={
            showAddModal
          }
          transparent
          animationType="slide"
          onRequestClose={
            closeModal
          }
        >
          <View
            style={
              styles.modalOverlay
            }
          >
            <KeyboardAvoidingView
              behavior={
                Platform.OS ===
                'ios'
                  ? 'padding'
                  : undefined
              }
              style={
                styles.modalKeyboard
              }
            >
              <View
                style={
                  styles.modalCard
                }
              >
                <View
                  style={
                    styles.modalHeader
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.modalTitle
                      }
                    >
                      {editingBoxer
                        ? 'EDIT BOXER'
                        : 'REGISTER BOXER'}
                    </Text>

                    <Text
                      style={
                        styles.modalSubtitle
                      }
                    >
                      {editingBoxer
                        ? `Editing ${editingBoxer.id}`
                        : 'Enter official boxer information'}
                    </Text>
                  </View>

                  <Pressable
                    style={
                      styles.closeButton
                    }
                    onPress={
                      closeModal
                    }
                  >
                    <Text
                      style={
                        styles.closeText
                      }
                    >
                      ×
                    </Text>
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={
                    false
                  }
                  keyboardShouldPersistTaps="handled"
                >
                  {editingBoxer && (
                    <View
                      style={
                        styles.idInfoBox
                      }
                    >
                      <Text
                        style={
                          styles.idInfoLabel
                        }
                      >
                        BOXER ID
                      </Text>

                      <Text
                        style={
                          styles.idInfoValue
                        }
                      >
                        {
                          editingBoxer.id
                        }
                      </Text>

                      <Text
                        style={
                          styles.idInfoText
                        }
                      >
                        Boxer ID cannot be changed.
                      </Text>
                    </View>
                  )}

                  <FormInput
                    label="FULL NAME"
                    placeholder="Enter full name"
                    value={
                      name
                    }
                    onChangeText={
                      setName
                    }
                  />

                  <FormInput
                    label="DATE OF BIRTH"
                    placeholder="DD/MM/YYYY"
                    value={
                      dateOfBirth
                    }
                    onChangeText={
                      setDateOfBirth
                    }
                    keyboardType="numbers-and-punctuation"
                  />

                  <FormInput
                    label="CURRENT WEIGHT"
                    placeholder="Example: 60 KG"
                    value={
                      weight
                    }
                    onChangeText={
                      setWeight
                    }
                  />

                  <FormInput
                    label="BOXING CLUB"
                    placeholder="Enter club name"
                    value={
                      club
                    }
                    onChangeText={
                      setClub
                    }
                  />

                  <FormInput
                    label="COACH"
                    placeholder="Enter coach name"
                    value={
                      coach
                    }
                    onChangeText={
                      setCoach
                    }
                  />

                  <View
                    style={
                      styles.formGroup
                    }
                  >
                    <Text
                      style={
                        styles.formLabel
                      }
                    >
                      STANCE
                    </Text>

                    <View
                      style={
                        styles.stanceRow
                      }
                    >
                      {[
                        'ORTHODOX',
                        'SOUTHPAW',
                      ].map(
                        (
                          item: string,
                        ) => (
                          <Pressable
                            key={
                              item
                            }
                            style={[
                              styles.stanceButton,
                              stance ===
                                item &&
                                styles.stanceActive,
                            ]}
                            onPress={() =>
                              setStance(
                                item,
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.stanceText,
                                stance ===
                                  item &&
                                  styles.stanceTextActive,
                              ]}
                            >
                              {
                                item
                              }
                            </Text>
                          </Pressable>
                        ),
                      )}
                    </View>
                  </View>

                  <View
                    style={
                      styles.infoBox
                    }
                  >
                    <Text
                      style={
                        styles.infoTitle
                      }
                    >
                      ADMIN CONTROL
                    </Text>

                    <Text
                      style={
                        styles.infoText
                      }
                    >
                      Official boxer information is stored securely in the PostgreSQL database through the backend API.
                    </Text>
                  </View>

                  <Pressable
                    style={[
                      styles.saveButton,
                      isSaving &&
                        styles.importingButton,
                    ]}
                    onPress={
                      handleSaveBoxer
                    }
                    disabled={
                      isSaving
                    }
                  >
                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      {isSaving
                        ? 'SAVING...'
                        : editingBoxer
                        ? 'SAVE CHANGES'
                        : 'REGISTER BOXER'}
                    </Text>

                    {!isSaving && (
                      <Text
                        style={
                          styles.saveArrow
                        }
                      >
                        →
                      </Text>
                    )}
                  </Pressable>

                  <View
                    style={
                      styles.modalBottomSpace
                    }
                  />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <PdfTextExtractor
          ref={
            pdfExtractorRef
          }
        />
      </View>
    </SafeAreaView>
  );
}

/*
 * =========================================================
 * FORM INPUT
 * =========================================================
 */

function FormInput({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (
    value: string,
  ) => void;
  keyboardType?: any;
}) {
  return (
    <View
      style={
        styles.formGroup
      }
    >
      <Text
        style={
          styles.formLabel
        }
      >
        {
          label
        }
      </Text>

      <TextInput
        style={
          styles.formInput
        }
        placeholder={
          placeholder
        }
        placeholderTextColor="#666D76"
        value={
          value
        }
        onChangeText={
          onChangeText
        }
        keyboardType={
          keyboardType
        }
      />
    </View>
  );
}

/*
 * =========================================================
 * DATE FORMATTER
 * =========================================================
 */

function formatDateForDisplay(
  value: string,
): string {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  const day =
    String(
      date.getUTCDate(),
    ).padStart(
      2,
      '0',
    );

  const month =
    String(
      date.getUTCMonth() +
        1,
    ).padStart(
      2,
      '0',
    );

  const year =
    date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        '#0B0D10',
    },

    container: {
      flex: 1,
      backgroundColor:
        '#0B0D10',
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 16,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderBottomWidth: 1,
      borderBottomColor:
        '#1D2229',
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor:
        '#15191F',
      borderWidth: 1,
      borderColor:
        '#292F37',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    backArrow: {
      color: '#FFFFFF',
      fontSize: 30,
      marginTop: -3,
    },

    headerTitleContainer: {
      flex: 1,
      marginLeft: 14,
    },

    headerTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 1,
    },

    headerSubtitle: {
      color: '#707883',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.3,
      marginTop: 3,
    },

    headerCount: {
      alignItems:
        'flex-end',
    },

    headerCountNumber: {
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight: '900',
    },

    headerCountLabel: {
      color: '#6D7580',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1,
    },

    searchContainer: {
      height: 48,
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 12,
      backgroundColor:
        '#15191F',
      borderWidth: 1,
      borderColor:
        '#292F37',
      borderRadius: 12,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    searchIcon: {
      color: '#7D858F',
      fontSize: 25,
      marginLeft: 14,
      marginRight: 7,
    },

    searchInput: {
      flex: 1,
      height: '100%',
      color: '#FFFFFF',
      fontSize: 13,
      paddingRight: 12,
    },

    /*
     * =======================================================
     * FILTER BUTTONS
     * =======================================================
     */

    filterContainer: {
      marginHorizontal: 20,
      marginBottom: 12,
      padding: 4,
      backgroundColor:
        '#11151A',
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#282E36',
      flexDirection:
        'row',
    },

    filterButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 9,
      alignItems:
        'center',
      justifyContent:
        'center',
      flexDirection:
        'row',
      gap: 5,
    },

    filterButtonActive: {
      backgroundColor:
        '#E53935',
    },

    filterButtonText: {
      color: '#727A84',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.6,
    },

    filterButtonTextActive: {
      color: '#FFFFFF',
    },

    filterCount: {
      color: '#525A64',
      fontSize: 8,
      fontWeight: '900',
    },

    filterCountActive: {
      color: '#FFFFFF',
    },

    /*
     * =======================================================
     * IMPORT
     * =======================================================
     */

    importButton: {
      minHeight: 68,
      marginHorizontal: 20,
      marginBottom: 12,
      paddingHorizontal: 14,
      backgroundColor:
        '#15191F',
      borderWidth: 1,
      borderColor:
        '#343A43',
      borderRadius: 13,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    importIconBox: {
      width: 40,
      height: 40,
      borderRadius: 11,
      backgroundColor:
        '#241719',
      borderWidth: 1,
      borderColor:
        '#4A282A',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    importIcon: {
      color: '#E53935',
      fontSize: 23,
      fontWeight: '700',
    },

    importContent: {
      flex: 1,
    },

    importButtonText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    importDescription: {
      color: '#6F7781',
      fontSize: 8,
      marginTop: 4,
    },

    selectedPdfText: {
      color: '#E57373',
      fontSize: 8,
      fontWeight: '700',
      marginTop: 5,
    },

    importArrow: {
      color: '#777F89',
      fontSize: 25,
      marginLeft: 8,
    },

    /*
     * =======================================================
     * ADD BUTTON
     * =======================================================
     */

    addButton: {
      height: 50,
      marginHorizontal: 20,
      backgroundColor:
        '#E53935',
      borderRadius: 12,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      elevation: 4,
    },

    addIcon: {
      color: '#FFFFFF',
      fontSize: 24,
      marginRight: 9,
    },

    addButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    buttonPressed: {
      opacity: 0.75,
    },

    /*
     * =======================================================
     * LIST
     * =======================================================
     */

    list: {
      flex: 1,
      marginTop: 18,
    },

    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 30,
    },

    sectionHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 10,
    },

    sectionTitle: {
      color: '#AEB4BD',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.4,
    },

    sectionCount: {
      color: '#5F6771',
      fontSize: 9,
      fontWeight: '800',
    },

    boxerCard: {
      backgroundColor:
        '#15191F',
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        '#282D35',
      padding: 16,
      marginBottom: 12,
    },

    cardTop: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    avatar: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor:
        '#20262E',
      borderWidth: 1,
      borderColor:
        '#363D47',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    avatarText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
    },

    nameContainer: {
      flex: 1,
      marginLeft: 12,
    },

    boxerName: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },

    boxerId: {
      color: '#737B86',
      fontSize: 10,
      fontWeight: '700',
      marginTop: 3,
      letterSpacing: 0.7,
    },

    tournamentBadge: {
      alignSelf:
        'flex-start',
      marginTop: 5,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 5,
      backgroundColor:
        '#241719',
      borderWidth: 1,
      borderColor:
        '#4A282A',
    },

    tournamentBadgeText: {
      color: '#E57373',
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    statusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 7,
    },

    activeBadge: {
      backgroundColor:
        '#102719',
    },

    inactiveBadge: {
      backgroundColor:
        '#241719',
    },

    statusText: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    activeText: {
      color: '#4CAF50',
    },

    inactiveText: {
      color: '#E57373',
    },

    detailsGrid: {
      flexDirection:
        'row',
      marginTop: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor:
        '#242A31',
    },

    detailItem: {
      flex: 1,
    },

    detailLabel: {
      color: '#626A75',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 5,
    },

    detailValue: {
      color: '#D4D8DD',
      fontSize: 11,
      fontWeight: '700',
    },

    clubRow: {
      flexDirection:
        'row',
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor:
        '#242A31',
    },

    clubInfo: {
      flex: 1,
    },

    clubText: {
      color: '#C9CDD2',
      fontSize: 11,
      fontWeight: '600',
    },

    actionsRow: {
      flexDirection:
        'row',
      marginTop: 16,
      gap: 7,
    },

    actionButton: {
      height: 40,
      borderRadius: 9,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    viewButton: {
      flex: 1.1,
      backgroundColor:
        '#20252C',
      borderWidth: 1,
      borderColor:
        '#343A43',
    },

    editButton: {
      flex: 0.8,
      backgroundColor:
        '#20252C',
      borderWidth: 1,
      borderColor:
        '#3A414B',
    },

    statusButton: {
      flex: 1.1,
      borderWidth: 1,
    },

    viewButtonText: {
      color: '#C7CBD1',
      fontSize: 8,
      fontWeight: '900',
    },

    editButtonText: {
      color: '#FFFFFF',
      fontSize: 8,
      fontWeight: '900',
    },

    deactivateButton: {
      backgroundColor:
        '#211719',
      borderColor:
        '#4A282A',
    },

    activateButton: {
      backgroundColor:
        '#112219',
      borderColor:
        '#285034',
    },

    statusButtonText: {
      fontSize: 8,
      fontWeight: '900',
    },

    deactivateText: {
      color: '#E57373',
    },

    activateText: {
      color: '#66BB6A',
    },

    /*
     * =======================================================
     * EMPTY
     * =======================================================
     */

    emptyState: {
      backgroundColor:
        '#15191F',
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        '#282D35',
      padding: 35,
      alignItems:
        'center',
      marginTop: 4,
    },

    emptyIcon: {
      fontSize: 36,
      marginBottom: 12,
    },

    emptyTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },

    emptyText: {
      color: '#747C86',
      fontSize: 11,
      textAlign:
        'center',
      marginTop: 6,
    },

    /*
     * =======================================================
     * MODALS
     * =======================================================
     */

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0, 0, 0, 0.72)',
      justifyContent:
        'flex-end',
    },

    modalKeyboard: {
      width: '100%',
    },

    tournamentKeyboard: {
      flex: 1,
      width: '100%',
    },

    modalCard: {
      backgroundColor:
        '#15191F',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 22,
      maxHeight: '92%',
      borderTopWidth: 1,
      borderColor:
        '#30353D',
    },

    modalBottomSpace: {
      height: 25,
    },

    tournamentModalCard: {
      backgroundColor:
        '#15191F',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 22,
      maxHeight: '88%',
      borderTopWidth: 1,
      borderColor:
        '#30353D',
    },

    tournamentModalScroll: {
      width: '100%',
    },

    tournamentModalScrollContent: {
      paddingBottom: 25,
    },

    modalHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 22,
    },

    modalHeaderText: {
      flex: 1,
    },

    modalTitle: {
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    modalSubtitle: {
      color: '#777F89',
      fontSize: 10,
      marginTop: 4,
    },

    closeButton: {
      marginLeft: 12,
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor:
        '#20252C',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    closeText: {
      color: '#BFC4CA',
      fontSize: 25,
    },

    importPreviewBox: {
      backgroundColor:
        '#10151B',
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        '#252D35',
      padding: 13,
      marginBottom: 18,
    },

    importPreviewLabel: {
      color: '#626A75',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 6,
    },

    importPreviewName: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },

    idInfoBox: {
      backgroundColor:
        '#10151B',
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        '#252D35',
      padding: 13,
      marginBottom: 16,
    },

    idInfoLabel: {
      color: '#626A75',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 5,
    },

    idInfoValue: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
    },

    idInfoText: {
      color: '#707883',
      fontSize: 9,
      marginTop: 4,
    },

    formGroup: {
      marginBottom: 16,
    },

    formLabel: {
      color: '#AEB4BD',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.1,
      marginBottom: 8,
    },

    formInput: {
      height: 50,
      backgroundColor:
        '#0D1014',
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        '#2C323A',
      paddingHorizontal: 14,
      color: '#FFFFFF',
      fontSize: 14,
    },

    stanceRow: {
      flexDirection:
        'row',
      gap: 8,
    },

    stanceButton: {
      flex: 1,
      height: 46,
      borderRadius: 10,
      backgroundColor:
        '#0D1014',
      borderWidth: 1,
      borderColor:
        '#2C323A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    stanceActive: {
      backgroundColor:
        '#E53935',
      borderColor:
        '#E53935',
    },

    stanceText: {
      color: '#777F89',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    stanceTextActive: {
      color: '#FFFFFF',
    },

    infoBox: {
      backgroundColor:
        '#10151B',
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        '#252D35',
      padding: 13,
      marginBottom: 18,
    },

    infoTitle: {
      color: '#E53935',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 5,
    },

    infoText: {
      color: '#7C848E',
      fontSize: 10,
      lineHeight: 15,
    },

    saveButton: {
      height: 52,
      borderRadius: 12,
      backgroundColor:
        '#E53935',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    importingButton: {
      backgroundColor:
        '#8E2929',
    },

    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    saveArrow: {
      color: '#FFFFFF',
      fontSize: 21,
      marginLeft: 10,
    },
  });