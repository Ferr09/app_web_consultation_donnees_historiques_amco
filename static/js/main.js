// static/js/main.js
// En static/js/main.js

// ===================================================================
// ==== GESTIONNAIRE DE NOTIFICATIONS GLOBAL                      ====
// ===================================================================
function afficherNotification(message, type = 'info', duree = 5000) {
    const conteneurNotifications = document.getElementById('conteneur-notifications');
    if (!conteneurNotifications) return;
    const icones = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-triangle', error: 'fa-times-circle' };
    const icone = icones[type] || 'fa-info-circle';
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `<i class="fas ${icone} notification-icon"></i><div class="notification-message">${message}</div><button class="notification-close">×</button>`;
    conteneurNotifications.appendChild(notif);
    requestAnimationFrame(() => { notif.classList.add('show'); });
    const fermerNotif = () => {
        notif.classList.remove('show');
        notif.classList.add('hide');
        setTimeout(() => notif.remove(), 500);
    };
    notif.querySelector('.notification-close').addEventListener('click', fermerNotif);
    if (duree > 0) setTimeout(fermerNotif, duree);
}

// ===================================================================
// ==== CODE PRINCIPAL AU CHARGEMENT DU DOM                       ====
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    const userId = document.body.dataset.userId || 'guest';

    // =============================================================
    // ==== FONCTIONS UTILITAIRES GÉNÉRIQUES (outils de l'UI)    ====
    // =============================================================
    function createCustomSelect(originalSelect) {
        if (!originalSelect) return; // Sécurité
        if (originalSelect.closest('.custom-select-wrapper')) return; // Déjà initialisé

        const valeursAExclure = ['qte', 'prixUnitaireHT', 'montantHT', 'totalHT', 'totalTTC'];
        

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-options';

        // Le select original est mis à l'intérieur du wrapper
        wrapper.appendChild(originalSelect);
        wrapper.appendChild(trigger);
        wrapper.appendChild(optionsContainer);
        originalSelect.classList.add('original-select');

        const updateTriggerText = () => {
            const selectedOption = originalSelect.options[originalSelect.selectedIndex];
            trigger.innerHTML = `<span>${selectedOption ? selectedOption.textContent : ''}</span><i class="fas fa-chevron-down arrow"></i>`;
            trigger.classList.toggle('placeholder', !originalSelect.value);
        };

        originalSelect.addEventListener('change', updateTriggerText);

        Array.from(originalSelect.options).forEach((optionElement, index) => {

            // 2. On vérifie si la valeur de l'option est dans notre liste d'exclusion
            if (valeursAExclure.includes(optionElement.value)) {
                return; // Si c'est le cas, on ignore cette option et on passe à la suivante
            }

            const customOption = document.createElement('div');
            customOption.className = 'custom-option';
            customOption.textContent = optionElement.textContent;
            customOption.dataset.value = optionElement.value;
            if (optionElement.selected) {
                customOption.classList.add('selected');
            }
            customOption.addEventListener('click', (e) => {
                e.stopPropagation();
                originalSelect.value = optionElement.value;
                originalSelect.dispatchEvent(new Event('change'));
                wrapper.classList.remove('open');
            });
            optionsContainer.appendChild(customOption);
        });

        updateTriggerText();

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select-wrapper.open').forEach(openSelect => {
                if (openSelect !== wrapper) {
                    openSelect.classList.remove('open');
                }
            });
            wrapper.classList.toggle('open');
        });

        document.addEventListener('click', () => wrapper.classList.remove('open'));

        // On retourne le div principal pour que la fonction appelante puisse l'utiliser
        return wrapper;
    }

    function creerSelecteurMois() {
        const picker = document.createElement('div');
        picker.className = 'custom-month-picker';
        const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        picker.innerHTML = `<div class="month-picker-header"><span class="nav-arrow prev-year">‹</span><span class="current-year"></span><span class="nav-arrow next-year">›</span></div><div class="month-grid"></div>`;
        document.body.appendChild(picker);
        const headerYear = picker.querySelector('.current-year');
        const monthGrid = picker.querySelector('.month-grid');
        let activeTrigger = null, targetYearInput = null, hiddenMonthInput = null, currentYear = 0;
        const render = () => {
            headerYear.textContent = currentYear;
            const selectedMonth = hiddenMonthInput?.value;
            const selectedYear = parseInt(targetYearInput?.value, 10);
            monthGrid.innerHTML = moisNoms.map((mois, index) => `<div class="month-cell ${parseInt(selectedMonth) === index + 1 && currentYear === selectedYear ? 'selected' : ''}" data-month="${index + 1}">${mois}</div>`).join('');
            monthGrid.querySelectorAll('.month-cell').forEach(cell => cell.addEventListener('click', () => {
                if (!activeTrigger) return;
                const monthValue = cell.dataset.month;
                targetYearInput.value = currentYear;
                activeTrigger.value = monthValue;
                hiddenMonthInput.value = monthValue;
                hide();
            }));
        };
        const show = (trigger, yearInput, monthHidInput) => {
            activeTrigger = trigger; targetYearInput = yearInput; hiddenMonthInput = monthHidInput;
            currentYear = parseInt(yearInput.value, 10) || new Date().getFullYear();
            render();
            const rect = trigger.getBoundingClientRect();
            picker.style.display = 'block';
            picker.style.top = `${rect.bottom + window.scrollY + 5}px`;
            picker.style.left = `${rect.left + window.scrollX}px`;
        };
        const hide = () => { picker.style.display = 'none'; activeTrigger = null; };
        picker.querySelector('.prev-year').addEventListener('click', () => { currentYear--; render(); });
        picker.querySelector('.next-year').addEventListener('click', () => { currentYear++; render(); });
        document.addEventListener('click', (e) => { if (activeTrigger && !picker.contains(e.target) && e.target !== activeTrigger) hide(); });
        return function attach(triggerInput, yearInput, monthHiddenInput) {
            triggerInput.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!/^\d{4}$/.test(yearInput.value)) return;
                activeTrigger === triggerInput ? hide() : show(triggerInput, yearInput, monthHiddenInput);
            });
        };
    }

    function synchroniserMois(inputVisible, inputCache) {
        if (!inputVisible || !inputCache) return;
        inputVisible.addEventListener('input', () => {
            let v = parseInt(inputVisible.value.replace(/[^0-9]/g, ''), 10);
            if (isNaN(v)) { inputVisible.value = inputCache.value = ''; return; }
            v = Math.min(12, Math.max(1, v));
            inputVisible.value = inputCache.value = v;
        });
        inputVisible.addEventListener('blur', () => {
            if (inputVisible.value === '') inputCache.value = '';
        });
    }

    function lierAnneeMois(anneeInput, moisVisible, moisCache) {
        if (!anneeInput || !moisVisible || !moisCache) return;
        const toggle = () => {
            if (/^\d{4}$/.test(anneeInput.value)) {
                moisVisible.style.display = 'inline-block';
            } else {
                moisVisible.style.display = 'none';
                moisVisible.value = '';
                moisCache.value = '';
            }
        };
        anneeInput.addEventListener('input', toggle);
        toggle();
    }

    function addFieldRow(champsDisponibles, container, ajouterLigneAuto = true) {
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'field-row';
        const clearBtn = document.createElement('span');
        clearBtn.className = 'clear-row-btn';
        clearBtn.title = 'Retirer';
        clearBtn.innerHTML = '×';
        clearBtn.addEventListener('click', () => {
            if (container.children.length > 1) { row.remove(); }
            else { // 1. Trouver les éléments à l'intérieur de CETTE ligne spécifique
                const fieldSelect = row.querySelector('select[name="field[]"]');
                const operatorSelect = row.querySelector('select[name="operator[]"]');
                const valueInput = row.querySelector('input[name="value[]"]');

                // 2. Vider le champ de texte
                if (valueInput) {
                    valueInput.value = '';
                }

                // 3. Réinitialiser les menus déroulants à leur première option
                if (fieldSelect) {
                    fieldSelect.selectedIndex = 0;
                    // On déclenche un événement 'change' pour que le select personnalisé se mette à jour
                    fieldSelect.dispatchEvent(new Event('change'));
                }
                if (operatorSelect) {
                    operatorSelect.selectedIndex = 0;
                    // On déclenche un événement 'change' pour que le select personnalisé se mette à jour
                    operatorSelect.dispatchEvent(new Event('change'));
                }
            }
        });
        const fieldSelect = document.createElement('select');
        fieldSelect.name = 'field[]';
        let opts = '<option value="">--Champ--</option>';
        champsDisponibles.forEach(c => { opts += `<option value="${c.valeur}">${c.texte}</option>`; });
        fieldSelect.innerHTML = opts;
        const operatorSelect = document.createElement('select');
        operatorSelect.name = 'operator[]';
        operatorSelect.innerHTML = `<option value="contains" selected>contient</option><option value="equals">égal à</option>`;
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.name = 'value[]';
        valueInput.placeholder = 'Valeur à filtrer';
        if (ajouterLigneAuto) {
            valueInput.addEventListener('input', () => {
                if (row === container.lastElementChild && valueInput.value.trim() !== '') {
                    addFieldRow(champsDisponibles, container, true);
                }
            });
        }
        row.appendChild(clearBtn);
        row.appendChild(createCustomSelect(fieldSelect));
        row.appendChild(createCustomSelect(operatorSelect));
        row.appendChild(valueInput);
        container.appendChild(row);
        return row;
    }

    // --- Initialisation des notifications et du bouton "Tout effacer" ---
    (function gererNotificationsAuChargement() {
        const params = new URLSearchParams(window.location.search);
        if (params.has('type_notif') && params.has('message_notif')) {
            afficherNotification(params.get('message_notif'), params.get('type_notif'));
        }
        const urlSansParams = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: urlSansParams }, '', urlSansParams);
    })();

    const btnClearAll = document.getElementById('btn-clear-all');
    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            const bodyFiltresAvances = document.querySelector('body[data-page="filtres-avances"]');
            if (bodyFiltresAvances) {
                // ==========================================================
                // === NOUVELLE LOGIQUE POUR LA PAGE DE FILTRES AVANCÉS ===
                // ==========================================================
                console.log("Action du bouton '×' : Réinitialisation de la page de filtres avancés.");

                // --- 1. Vider le localStorage pour cette requête spécifique ---
                const requeteId = bodyFiltresAvances.dataset.requeteId;
                if (requeteId) {
                    const advancedKey = `filtres_requete_${requeteId}`;
                    localStorage.removeItem(advancedKey);
                    console.log(`Clé de stockage '${advancedKey}' supprimée.`);
                }

                // --- 2. Vider les champs de la période de date ---
                const sy = document.getElementById('start_year');
                const sm_visible = document.getElementById('start_month_visible');
                const sm = document.getElementById('start_month');
                const ey = document.getElementById('end_year');
                const em_visible = document.getElementById('end_month_visible');
                const em = document.getElementById('end_month');

                if (sy) sy.value = '';
                if (sm_visible) sm_visible.value = '';
                if (sm) sm.value = '';
                if (ey) ey.value = '';
                if (em_visible) em_visible.value = '';
                if (em) em.value = '';

                // Déclencher l'événement 'input' pour que la logique de masquage des mois s'applique
                if (sy) sy.dispatchEvent(new Event('input'));
                if (ey) ey.dispatchEvent(new Event('input'));

                // --- 3. Vider et réinitialiser les filtres dynamiques ---
                const container = document.getElementById('fields-container');
                // On récupère les champs disponibles depuis la variable globale que le template a créée
                const champsDisponibles = window.CHAMPS_FILTRABLES || [];

                if (container) {
                    container.innerHTML = ''; // Vider complètement le conteneur
                    if (champsDisponibles.length > 0) {
                        // Ajouter une seule ligne vide, comme au chargement initial
                        addFieldRow(champsDisponibles, container, true);
                    } else {
                        // Gérer le cas où il n'y a pas de filtres pour cette requête
                        container.innerHTML = "<p class='no-filters-message'>Cette requête ne nécessite aucun filtre supplémentaire.</p>";
                    }
                }

                // Notification pour l'utilisateur
                afficherNotification("Tous les filtres ont été réinitialisés.", "info");

            } else {
                // Comportement pour la page simple (reste inchangé)
                console.log("Action du bouton '×' : Réinitialisation de la page simple.");
                const simpleKey = `etatFiltresSimple_${userId}`;
                localStorage.removeItem(simpleKey);
                localStorage.removeItem('typeTransactionSelection');
                afficherNotification("Tous les filtres ont été réinitialisés.", "info");
                window.location.reload(); // Pour la page simple, un rechargement est suffisant.
                // Notification pour l'utilisateur

            }
        });

    }

    // ===================================================================
    // ==== GESTION CENTRALISÉE DES FORMULAIRES DE RECHERCHE          ====
    // ===================================================================

    const formulaireDeRecherche = document.getElementById('form-advanced');

    if (formulaireDeRecherche) {
        const estRechercheSimple = formulaireDeRecherche.hasAttribute('data-simple-search');

        if (estRechercheSimple) {
            // -----------------------------------------------------------------
            // --- CAS 1 : ON EST SUR LA PAGE DE RECHERCHE SIMPLE
            // -----------------------------------------------------------------
            console.log("🚀 Initialisation de la page de RECHERCHE SIMPLE.");

            const STORAGE_KEY_SIMPLE = `etatFiltresSimple_${userId}`;
            const container = document.getElementById('fields-container');
            const sy = document.getElementById('start_year');
            const sm = document.getElementById('start_month');
            const sm_visible = document.getElementById('start_month_visible');
            const ey = document.getElementById('end_year');
            const em = document.getElementById('end_month');
            const em_visible = document.getElementById('end_month_visible');
            const typeTransactionRadios = document.querySelectorAll('input[name="type_transaction"]');
            const clearPeriod = document.querySelector('.clear-btn[title="Effacer la période"]');

            // =====================================================================
            // === BLOC DE DÉBOGAGE - PARTIE 1 ===
            // =====================================================================

            const conteneurInterrupteur = document.querySelector('.toggle-switch');

            // DEBUG 1: Vérifions si le conteneur est trouvé
            console.log("DEBUG 1: Conteneur de l'interrupteur trouvé :", conteneurInterrupteur);

            if (conteneurInterrupteur) {
                conteneurInterrupteur.addEventListener('click', (event) => {
                    // DEBUG 2: Un clic a été détecté dans le conteneur
                    console.log("DEBUG 2: Clic détecté ! Cible du clic :", event.target);

                    const labelCible = event.target.closest('label');
                    // DEBUG 3: Vérifions si un label a été trouvé
                    console.log("DEBUG 3: Label trouvé :", labelCible);

                    if (labelCible) {
                        const inputId = labelCible.getAttribute('for');
                        const inputRadio = document.getElementById(inputId);
                        // DEBUG 4: Vérifions l'input radio trouvé
                        console.log("DEBUG 4: Input radio correspondant trouvé :", inputRadio);

                        if (inputRadio && !inputRadio.checked) {
                            // DEBUG 5: L'input n'était pas coché, nous allons le faire maintenant.
                            console.log("DEBUG 5: Changement de l'état 'checked' pour :", inputRadio.id);
                            inputRadio.checked = true;

                            const changeEvent = new Event('change', { bubbles: true });
                            inputRadio.dispatchEvent(changeEvent);
                        }
                    }
                });
            }



            const champsParType = {
                ventes: [{ valeur: 'codeArticle', texte: 'Code Article' }, { valeur: 'designation', texte: 'Désignation' }, { valeur: 'codeClient', texte: 'Code Client' }, { valeur: 'raisonSociale', texte: 'Raison Sociale Client' }, { valeur: 'qte', texte: 'Quantité' }, { valeur: 'prixUnitaireHT', texte: 'Prix Unitaire HT' }, { valeur: 'montantHT', texte: 'Montant HT' }, { valeur: 'erp', texte: 'ERP' }],
                achats: [{ valeur: 'codeFournisseur', texte: 'Code Fournisseur' }, { valeur: 'raisonSociale', texte: 'Raison Sociale Fournisseur' }, { valeur: 'referenceAchat', texte: 'Référence Achat' }, { valeur: 'bonDeCommande', texte: 'Bon de Commande' }, { valeur: 'qte', texte: 'Quantité' }, { valeur: 'totalHT', texte: 'Total HT' }, { valeur: 'totalTTC', texte: 'Total TTC' }, { valeur: 'referenceArticle', texte: 'Référence Article' }, { valeur: 'erp', texte: 'ERP' }]
            };



            function sauvegarderFiltres() {
                const etat = {
                    match_mode: formulaireDeRecherche.querySelector('input[name="match_mode"]:checked')?.value || 'all',
                    start_year: sy.value.trim(),
                    start_month: sm.value.trim(),
                    end_year: ey.value.trim(),
                    end_month: em.value.trim(),
                    fields: Array.from(container.querySelectorAll('.field-row')).map(row => ({
                        field: row.querySelector('select[name="field[]"]')?.value,
                        operator: row.querySelector('select[name="operator[]"]')?.value,
                        value: row.querySelector('input[name="value[]"]')?.value.trim()
                    })).filter(f => f.field || f.value)
                };
                localStorage.setItem(STORAGE_KEY_SIMPLE, JSON.stringify(etat));


                // On utilise 'document.querySelector' au lieu de 'formulaireDeRecherche.querySelector'
                const typeSelectionne = document.querySelector('input[name="type_transaction"]:checked')?.value || 'ventes';
                localStorage.setItem('typeTransactionSelection', typeSelectionne);

            }
            function initialiserOuReinitialiserInterface(container, champsParType) {
                const typeActuel = document.querySelector('input[name="type_transaction"]:checked')?.value || 'ventes';
                const filtresSauvegardes = JSON.parse(localStorage.getItem(STORAGE_KEY_SIMPLE) || '{}');
                const selectionSauvegardee = localStorage.getItem('typeTransactionSelection');

                if (container) container.innerHTML = '';

                if (filtresSauvegardes.fields && filtresSauvegardes.fields.length > 0 && typeActuel === selectionSauvegardee) {
                    filtresSauvegardes.fields.forEach(f => {
                        const nouvelleLigne = addFieldRow(champsParType[typeActuel], container, true);
                        const fieldSelect = nouvelleLigne.querySelector('select[name="field[]"]');
                        const operatorSelect = nouvelleLigne.querySelector('select[name="operator[]"]');
                        const valueInput = nouvelleLigne.querySelector('input[name="value[]"]');
                        if (fieldSelect) fieldSelect.value = f.field;
                        if (operatorSelect) operatorSelect.value = f.operator;
                        if (valueInput) valueInput.value = f.value;
                        fieldSelect?.dispatchEvent(new Event('change'));
                        operatorSelect?.dispatchEvent(new Event('change'));
                    });
                }
                if (!container.querySelector('.field-row')) {
                    addFieldRow(champsParType[typeActuel], container, true);
                }
            }

            function chargerFiltresSauvegardes() {
                const etatSauvegarde = JSON.parse(localStorage.getItem(STORAGE_KEY_SIMPLE) || '{}');
                if (etatSauvegarde.start_year) sy.value = etatSauvegarde.start_year;
                if (etatSauvegarde.start_month) { sm.value = etatSauvegarde.start_month; sm_visible.value = etatSauvegarde.start_month; }
                if (etatSauvegarde.end_year) ey.value = etatSauvegarde.end_year;
                if (etatSauvegarde.end_month) { em.value = etatSauvegarde.end_month; em_visible.value = etatSauvegarde.end_month; }
                sy.dispatchEvent(new Event('input'));
                ey.dispatchEvent(new Event('input'));
                const selectionInitiale = localStorage.getItem('typeTransactionSelection') || 'ventes';
                const radioInitial = document.querySelector(`input[name="type_transaction"][value="${selectionInitiale}"]`);
                if (radioInitial) radioInitial.checked = true;

                initialiserOuReinitialiserInterface(container, champsParType);
            }

            // Initialisation de l'UI
            formulaireDeRecherche.querySelectorAll('select').forEach(createCustomSelect);
            const attacherSelecteurMois = creerSelecteurMois();
            attacherSelecteurMois(sm_visible, sy, sm);
            attacherSelecteurMois(em_visible, ey, em);
            synchroniserMois(sm_visible, sm);
            synchroniserMois(em_visible, em);
            lierAnneeMois(sy, sm_visible, sm);
            lierAnneeMois(ey, em_visible, em);

            typeTransactionRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    localStorage.setItem('typeTransactionSelection', e.target.value);
                    initialiserOuReinitialiserInterface(container, champsParType);
                });
            });

            if (clearPeriod) {
                clearPeriod.addEventListener('click', () => {
                    sy.value = ''; ey.value = '';
                    sy.dispatchEvent(new Event('input'));
                    ey.dispatchEvent(new Event('input'));
                });
            }

            formulaireDeRecherche.addEventListener('submit', e => {
                e.preventDefault();

                // =======================================================
                // ==== 1. VALIDATION DE LA PÉRIODE DE DATE           ====
                // =======================================================
                const anneeDebutVal = sy.value;
                const moisDebutVal = sm.value || '1'; // Si le mois est vide, on prend '1' (Janvier)
                const anneeFinVal = ey.value;
                const moisFinVal = em.value || '12'; // Si le mois est vide, on prend '12' (Décembre)

                // On ne compare les dates que si les deux années sont remplies
                if (anneeDebutVal && anneeFinVal) {
                    const dateDebut = new Date(anneeDebutVal, moisDebutVal - 1, 1);
                    // Pour la date de fin, on prend le dernier jour du mois pour une comparaison juste
                    const dateFin = new Date(anneeFinVal, moisFinVal, 0);

                    if (dateFin < dateDebut) {
                        afficherNotification("Erreur : La date de fin ne peut pas être antérieure à la date de début.", 'error');
                        return; // On arrête l'exécution ici
                    }
                }

                // =======================================================
                // ==== 2. VALIDATION DES CHAMPS DE FILTRE DYNAMIQUES ====
                // =======================================================
                for (const row of container.querySelectorAll('.field-row')) {
                    const champ = row.querySelector('select[name="field[]"]').value;
                    const valeur = row.querySelector('input[name="value[]"]').value.trim();

                    // CAS 1 : Un champ est sélectionné mais la valeur est vide
                    if (champ && !valeur) {
                        afficherNotification("Erreur : Vous devez entrer une valeur pour le champ sélectionné.", 'error');
                        return; // On arrête l'exécution ici
                    }

                    // CAS 2 : Une valeur est entrée mais aucun champ n'est sélectionné
                    if (!champ && valeur) {
                        afficherNotification("Erreur : Vous devez sélectionner un champ pour la valeur entrée.", 'error');
                        return; // On arrête l'exécution ici
                    }
                }

                // =======================================================
                // ==== SI TOUTES LES VALIDATIONS PASSENT...            ====
                // =======================================================
                // Si on arrive ici, c'est que tout est valide.
                console.log("Validation réussie. Sauvegarde et redirection...");

                afficherNotification("Filtres appliqués. Redirection vers les résultats...", "info", 2000);
                sauvegarderFiltres();
                setTimeout(() => {
                    window.location.href = '/filtre-requete/resultat-requete';
                }, 500);
            });

            chargerFiltresSauvegardes();

        } else {
            // -----------------------------------------------------------------
            // --- CAS 2 : ON EST SUR LA PAGE DE RECHERCHE AVANCÉE
            // -----------------------------------------------------------------
            // On récupère les éléments nécessaires pour la validation, comme pour le formulaire simple
            console.log("🚀 Initialisation de la page de RECHERCHE AVANCÉE.");

            const container = document.getElementById('fields-container');
            const sy = document.getElementById('start_year');
            const sm = document.getElementById('start_month');
            const ey = document.getElementById('end_year');
            const em = document.getElementById('end_month');

            // On attache UN SEUL et UNIQUE écouteur de soumission.
            formulaireDeRecherche.addEventListener('submit', e => {
                console.log("Événement 'submit' du formulaire avancé déclenché.");

                // On définit une variable pour suivre si une erreur a été trouvée.
                let erreurTrouvee = false;

                // --- Validation de la période ---
                if (sy && ey && sy.value && ey.value) {
                    const dateDebut = new Date(sy.value, (sm.value || 1) - 1, 1);
                    const dateFin = new Date(ey.value, (em.value || 12), 0);
                    if (dateFin < dateDebut) {
                        afficherNotification("Erreur : La date de fin ne peut pas être antérieure à la date de début.", 'error');
                        erreurTrouvee = true;
                    }
                }

                // --- Validation des champs dynamiques ---
                if (container) {
                    for (const row of container.querySelectorAll('.field-row')) {
                        // Si on a déjà trouvé une erreur, pas la peine de continuer à spammer des notifications
                        if (erreurTrouvee) break;

                        const champ = row.querySelector('select[name="field[]"]').value;
                        const valeur = row.querySelector('input[name="value[]"]').value.trim();
                        if ((champ && !valeur) || (!champ && valeur)) {
                            afficherNotification("Erreur : Chaque ligne de filtre doit être complète ou entièrement vide.", 'error');
                            erreurTrouvee = true;
                        }
                    }
                }

                // --- Décision finale ---
                if (erreurTrouvee) {
                    console.log("Erreur de validation trouvée. Blocage de la soumission.");
                    e.preventDefault(); // On bloque la soumission UNIQUEMENT si une erreur a été trouvée.
                } else {
                    // Si aucune erreur n'est trouvée, on affiche la notification de succès.
                    // Le formulaire s'enverra normalement car on n'appelle pas e.preventDefault().
                    console.log("Validation réussie. Le formulaire va être soumis.");
                    afficherNotification("Recherche en cours…", "info", 2000);
                }
            });
        }
    }

    // ===================================================================================
    // ==== PARTIE 2 : LOGIQUE POUR LA PAGE DE RÉSULTATS (ex: resultat-requete.html) ====
    // ===================================================================================
    const resultsTableBody = document.querySelector('#tableau-corps');
    if (resultsTableBody) {
        // Sélecteurs de la page de résultats
        console.log("🚀 Initialisation de la page de RÉSULTATS SIMPLES.");
        const btnPrev = document.getElementById('prev-page');
        const btnNext = document.getElementById('next-page');
        const pageNumSpan = document.getElementById('page-number');
        const btnDownload = document.getElementById('btn-download');
        const pageType = document.body.dataset.page;

        // 2. On déclare une variable qui contiendra la bonne clé de stockage
        let storageKeyForFilters = '';

        // 3. On choisit la bonne clé en fonction du type de page
        if (pageType === 'resultats-simples') {
            console.log("🚀 Initialisation de la page de RÉSULTATS SIMPLES.");
            storageKeyForFilters = `etatFiltresSimple_${userId}`;
        } else if (pageType === 'resultats-avances') {
            console.log("🚀 Initialisation de la page de RÉSULTATS AVANCÉS.");
            // Logique pour obtenir la clé des filtres avancés
            const derniereRequete = JSON.parse(localStorage.getItem('derniere_requete_avancee') || '{}');
            const requeteId = derniereRequete.id;
            if (requeteId) {
                storageKeyForFilters = `filtres_requete_${requeteId}`;
            } else {
                console.error("ID de la requête avancée non trouvé dans le localStorage.");
                // On peut définir une clé par défaut ou laisser vide pour attraper l'erreur plus tard
            }
        } else {
            console.warn("Attribut 'data-page' non trouvé sur le body. Le téléchargement pourrait échouer.");
        }

        // Variables d'état
        let dataResults = [], filteredData = [], currentPage = 1, pageSize = 15, totalPages = 1, usingDemo = false;

        function showDemoBanner() {
            if (document.querySelector('.demo-banner')) return;
            const banner = document.createElement('div');
            banner.className = 'demo-banner';
            banner.textContent = "Mode démonstration : les données affichées sont fictives (connexion à la base de données indisponible).";
            document.body.prepend(banner);
        }


        // main.js -> dans la PARTIE 2

        function appliquerFiltresPourDemo(donneesBrutes, filtres) {
            console.log("Filtrage côté client pour le mode DÉMO avec les filtres :", filtres);
            let resultat = [...donneesBrutes];
            const typeSelectionne = localStorage.getItem('typeTransactionSelection') || 'ventes';

            // On utilise les mêmes noms de colonnes que dans la base de données
            const champDate = (typeSelectionne === 'achats') ? 'date achat' : 'Date BL';

            // Logique de filtrage par date (utilise maintenant le bon nom de champ)
            const syVal = parseInt(filtres.start_year, 10) || 1900;
            const smVal = parseInt(filtres.start_month, 10) || 1;
            const eyVal = parseInt(filtres.end_year, 10) || new Date().getFullYear();
            const emVal = parseInt(filtres.end_month, 10) || 12;
            const dateDebut = new Date(syVal, smVal - 1, 1);

            // Logique de date de fin corrigée pour inclure tout le mois de fin
            const dateFin = (emVal === 12) ? new Date(eyVal + 1, 0, 1) : new Date(eyVal, emVal, 1);

            resultat = resultat.filter(item => {
                if (!item[champDate]) return false;
                const d = new Date(item[champDate]);
                return d >= dateDebut && d < dateFin;
            });

            // Logique de filtrage par champs (cette partie est déjà correcte)
            const mode = filtres.match_mode || 'all';
            const filtresValides = (filtres.fields || []).filter(f => f.field && f.value);
            if (filtresValides.length > 0) {
                if (mode === 'all') {
                    filtresValides.forEach(f => {
                        const val = f.value.toLowerCase();
                        resultat = resultat.filter(item => {
                            const cell = String(item[f.field] ?? '').toLowerCase();
                            if (f.operator === 'contains') return cell.includes(val);
                            if (f.operator === 'equals') return cell === val;
                            return cell.startsWith(val);
                        });
                    });
                } else { // 'any'
                    resultat = resultat.filter(item => filtresValides.some(f => {
                        const val = f.value.toLowerCase();
                        const cell = String(item[f.field] ?? '').toLowerCase();
                        if (f.operator === 'contains') return cell.includes(val);
                        if (f.operator === 'equals') return cell === val;
                        return cell.startsWith(val);
                    }));
                }
            }

            console.log(`Filtrage démo terminé. ${resultat.length} résultats trouvés.`);
            return resultat;
        }

        // main.js

        function updateResultCount () {
            const qteResultats = document.getElementById('result-count');
            if (!qteResultats) return; // Sécurité
            
            const totalResults = filteredData.length;

            if (totalResults > 0) {
            qteResultats.innerHTML = `<h3>${totalResults} résultat${totalResults > 1 ? 's' : ''}</h3>`;
            } else {
            qteResultats.innerHTML = '<h3>Aucun résultat</h3>';
            }
            return;
        }

        function renderTable() {
            const enTeteTableau = document.querySelector('#tableau-en-tete');
            const corpsTableau = document.querySelector('#tableau-corps');

            // On vide le contenu précédent
            if (!enTeteTableau || !corpsTableau) return; // Sécurité
            enTeteTableau.innerHTML = '';
            corpsTableau.innerHTML = '';

            const typeSelectionne = localStorage.getItem('typeTransactionSelection') || 'ventes';
            const start = (currentPage - 1) * pageSize;
            const donneesPage = filteredData.slice(start, start + pageSize);

            // --- DÉBOGAGE UTILE ---
            if (donneesPage.length > 0) {
                console.log("Structure du premier objet à afficher:", donneesPage[0]);
            }
            // ----------------------

            if (donneesPage.length === 0) {
                corpsTableau.innerHTML = `<tr><td colspan="10" class="text-center">Aucun résultat à afficher.</td></tr>`;
                return;
            }

            if (typeSelectionne === 'achats') {
                // --- VUE ACHATS (CORRIGÉE) ---
                enTeteTableau.innerHTML = `
            <th>Raison Sociale</th>
            <th>Réf. Achat</th>
            <th>Bon de Commande</th>
            <th>Date Achat</th>
            <th>Code Article</th>
            <th class="text-right">Qté Fact.</th>
            <th class="text-right">Total HT</th>
            <th class="text-right">Total TTC</th>
            <th>ERP</th>
        `;

                donneesPage.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                <td>${item['Raison sociale'] || 'N/A'}</td>
                <td>${item['Reference achat'] || 'N/A'}</td>
                <td>${item['Bon de commande'] || 'N/A'}</td>
                <td>${new Date(item['date achat']).toLocaleDateString('fr-FR')}</td>
                <td>${item['code article'] || 'N/A'}</td>
                <td class="text-right">${item['Qté fact'] || 0}</td>
                <td class="text-right">${(item['Total HT'] || 0).toFixed(2)} €</td>
                <td class="text-right">${(item['Total TTC'] || 0).toFixed(2)} €</td>
                <td>${item['ERP'] || 'N/A'}</td>
            `;
                    corpsTableau.appendChild(tr);
                });

            } else { // 'ventes'
                // --- VUE VENTES (CORRIGÉE) ---
                enTeteTableau.innerHTML = `
            <th>Code Article</th>
            <th>Désignation</th>
            <th>Code Client</th>
            <th>Raison Sociale</th>
            <th>Date BL</th>
            <th class="text-right">Qté Fact.</th>
            <th class="text-right">Prix U.</th>
            <th class="text-right">Total HT</th>
            <th>ERP</th>
        `;

                donneesPage.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                <td>${item['code article'] || 'N/A'}</td>
                <td>${item['Désignation'] || 'N/A'}</td>
                <td>${item['Code client'] || 'N/A'}</td>
                <td>${item['Raison sociale'] || 'N/A'}</td>
                <td>${new Date(item['Date BL']).toLocaleDateString('fr-FR')}</td>
                <td class="text-right">${item['Qté fact'] || 0}</td>
                <td class="text-right">${(item['Prix Unitaire'] || 0).toFixed(2)} €</td>
                <td class="text-right">${(item['Tot HT'] || 0).toFixed(2)} €</td>
                <td>${item['ERP'] || 'N/A'}</td>
            `;
                    corpsTableau.appendChild(tr);
                });
            }
        }

        function updatePagination() {
            totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
            currentPage = Math.min(currentPage, totalPages);
            pageNumSpan.textContent = `${currentPage} / ${totalPages}`;
            btnPrev.disabled = currentPage === 1;
            btnNext.disabled = currentPage >= totalPages;
        }



        async function chargerEtAfficherDonnees() {
            console.log('▶️ Lancement du chargement et de l\'affichage des données...');

            // Récupérer le type de transaction et les filtres bruts depuis localStorage
            const typeSelectionne = localStorage.getItem('typeTransactionSelection') || 'ventes';
            const filtresDepuisStorage = JSON.parse(localStorage.getItem(storageKeyForFilters) || '{}');

            // --- ÉTAPE 1: Enrichir les filtres avec des valeurs par défaut ---
            // On crée une copie pour ne pas modifier ce qui est dans localStorage
            const filtresEnrichis = {
                ...filtresDepuisStorage,
                fields: filtresDepuisStorage.fields ? [...filtresDepuisStorage.fields] : [] // Copie profonde des champs
            };

            const aujourdhui = new Date();

            // Si l'année de début est absente ou vide, on met 1900-01
            if (!filtresEnrichis.start_year) {
                filtresEnrichis.start_year = '1900';
                filtresEnrichis.start_month = '1';
            } else if (!filtresEnrichis.start_month) {
                // Si l'année est là mais pas le mois, on met janvier
                filtresEnrichis.start_month = '1';
            }

            // Si l'année de fin est absente ou vide, on met la date actuelle
            if (!filtresEnrichis.end_year) {
                filtresEnrichis.end_year = aujourdhui.getFullYear().toString();
                filtresEnrichis.end_month = (aujourdhui.getMonth() + 1).toString();
            } else if (!filtresEnrichis.end_month) {
                // Si l'année est là mais pas le mois, on met décembre
                filtresEnrichis.end_month = '12';
            }

            // --- ÉTAPE 2: Tenter de charger les données réelles avec les filtres enrichis ---
            try {
                console.log("Essai de l'API réelle (/api/query) avec les filtres enrichis :", filtresEnrichis);

                const res = await fetch('/api/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type_transaction: typeSelectionne,
                        filtres: filtresEnrichis // On envoie l'objet enrichi
                    })
                });

                if (!res.ok) {
                    throw new Error(`API réelle non disponible (${res.status})`);
                }

                filteredData = await res.json();
                usingDemo = false;
                console.log(`✅ Données réelles (déjà filtrées par le serveur) chargées : ${filteredData.length} lignes.`);

            } catch (err) {
                // --- ÉTAPE 3: En cas d'échec, basculer en mode démonstration ---
                console.warn(`${err.message}. Basculement sur les données de démonstration.`);
                usingDemo = true;
                showDemoBanner();

                try {
                    const resDemo = await fetch(`/demo/${typeSelectionne}`);
                    if (!resDemo.ok) {
                        throw new Error(`Fichier de démo non trouvé`);
                    }

                    const demoDataBrutes = await resDemo.json();
                    console.log(`✅ Données de démo chargées (${demoDataBrutes.length} lignes brutes).`);

                    // On utilise la fonction de filtrage JS avec les mêmes filtres enrichis
                    filteredData = appliquerFiltresPourDemo(demoDataBrutes, filtresEnrichis);

                } catch (demoErr) {
                    console.error('❌ ERREUR CRITIQUE en mode démo :', demoErr.message);
                    filteredData = [];
                }
            }

            // --- ÉTAPE 4: Afficher le résultat final ---
            currentPage = 1; // Toujours réinitialiser à la première page
            updatePagination();
            renderTable();
            updateResultCount();
        }

        btnPrev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); updatePagination(); updateResultCount();} });
        btnNext.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderTable(); updatePagination(); updateResultCount();} });

        btnDownload.addEventListener('click', async () => {
            const texteOriginal = btnDownload.textContent;
            btnDownload.textContent = 'Génération...';
            btnDownload.disabled = true;
            try {
                const format = document.querySelector('input[name="download_format"]:checked').value;
                const filtres = JSON.parse(localStorage.getItem(storageKeyForFilters) || '{}');
                const typeSelectionne = localStorage.getItem('typeTransactionSelection') || 'ventes';
                const downloadUrl = usingDemo
                    ? `/demo/${typeSelectionne}/download`
                    : `/api/${typeSelectionne}/download`;

                console.log(`▶️ Appel de la route de téléchargement : ${downloadUrl}`);

                const reponse = await fetch(downloadUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ format, filtres })
                });

                if (!reponse.ok) {
                    const contentType = reponse.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const donneesErreur = await reponse.json();
                        throw new Error(donneesErreur.erreur || `Erreur du serveur : ${reponse.statusText}`);
                    } else {
                        throw new Error('Erreur d\'authentification ou de serveur. Vérifiez la console du serveur Flask.');
                    }
                }

                const blob = await reponse.blob();
                const contentDisposition = reponse.headers.get('Content-Disposition');
                let nomFichier = `export.${format}`;
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename="?(.+)"?/i);
                    if (match) nomFichier = match[1];
                }
                const lien = document.createElement('a');
                lien.href = URL.createObjectURL(blob);
                lien.download = nomFichier;
                document.body.appendChild(lien);
                lien.click();
                document.body.removeChild(lien);
                URL.revokeObjectURL(lien.href);
            } catch (erreur) {
                console.error('❌ Erreur lors du téléchargement :', erreur);
                afficherNotification(`Erreur lors du téléchargement : ${erreur.message}`, 'error');
            } finally {
                btnDownload.textContent = texteOriginal;
                btnDownload.disabled = false;
                afficherNotification("Téléchargement terminé.", "success", 2000);
            }
        });

        // Lancement initial du chargement des données sur la page de résultats
        chargerEtAfficherDonnees();
    }

    // ===================================================================
    // ==== PARTIE 3 : LOGIQUE POUR LA PAGE DE GESTION DES COMPTES    ====
    // ===================================================================
    const formAjouterCompte = document.getElementById('form-ajouter-compte');
    if (formAjouterCompte) {
        console.log("🚀 Initialisation de la page de GESTION DES COMPTES...");

        // --- Sélecteurs des éléments du DOM ---
        const corpsTableau = document.getElementById('corps-table-comptes');
        const fenetreModale = document.getElementById('modal-confirmation');
        const messageModal = document.getElementById('modal-message');
        const conteneurCodeModal = document.getElementById('modal-code-conteneur');
        const affichageCodeModal = document.getElementById('modal-code-affichage');
        const btnAnnulerModal = document.getElementById('btn-modal-annuler');
        const btnConfirmerModal = document.getElementById('btn-modal-confirmer');
        const btnRegenererModal = document.getElementById('btn-modal-regenerer');
        let listeUtilisateurs = [];

        // --- Fonctions API (inchangées) ---
        async function chargerComptes() {
            try {
                const reponse = await fetch('/admin/api/comptes');
                if (!reponse.ok) throw new Error(`Erreur réseau: ${reponse.status}`);
                listeUtilisateurs = await reponse.json();
                redessinerTableau();
            } catch (erreur) {
                corpsTableau.innerHTML = `<tr><td colspan="5">Erreur lors du chargement des données.</td></tr>`;
                console.error(erreur);
            }
        }
        async function sauvegarderComptes(utilisateurs) {
            try {
                const reponse = await fetch('/admin/api/comptes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(utilisateurs) });
                const resultat = await reponse.json();
                if (!reponse.ok) throw new Error(resultat.erreur || `Erreur serveur ${reponse.status}`);
                return resultat;
            } catch (erreur) {
                afficherNotification(erreur.message, 'error');
                return null;
            }
        }

        // --- Fonctions UI ---
        function redessinerTableau() {
            corpsTableau.innerHTML = '';
            listeUtilisateurs.forEach(utilisateur => {
                const tr = document.createElement('tr');
                tr.dataset.emailUtilisateur = utilisateur.email;
                const roleClasse = utilisateur.role === 'admin' ? 'role-admin' : 'role-user';
                const roleTexte = utilisateur.role === 'admin' ? 'Admin' : 'Utilisateur';
                const estActifCoche = utilisateur.actif ? 'checked' : '';
                const etatBadgeClasse = utilisateur.actif ? 'badge-succes' : 'badge-erreur';
                const etatTexte = utilisateur.actif ? 'Actif' : 'Inactif';
                tr.innerHTML = `
        <td>${utilisateur.email}</td>
        <td class="cellule-etat">
            <span class="${etatBadgeClasse}">${etatTexte}</span>
            <label class="switch">
                <input type="checkbox" class="toggle-actif" ${estActifCoche}>
                <span class="slider"></span> <!-- ¡ELEMENTO AÑADIDO! -->
            </label>
        </td>
        <td class="cellule-actions-centrees"><button class="btn btn-secondaire btn-voir-code" title="Voir le code de secours"><i class="fas fa-eye"></i> Visionner</button></td>
        <td><span class="role-badge ${roleClasse}">${roleTexte}</span></td>
        <td><button class="btn-supprimer" title="Supprimer le compte"><i class="fas fa-trash-alt"></i></button></td>
    `;
                corpsTableau.appendChild(tr);
            });
        }


        // --- Fonction Maîtresse du Modal (inchangée et correcte) ---
        function afficherModal(parametres) {
            return new Promise(resolve => {
                // Définir les actions que les boutons effectueront

                const surConfirmation = () => nettoyerEtFermer(true);
                const surAnnulation = () => nettoyerEtFermer(false);
                const surRegeneration = () => nettoyerEtFermer('regenerer');

                // Fonction pour fermer le modal et retirer les écouteurs
                const nettoyerEtFermer = (valeurRetour) => {
                    // Retirer les écouteurs pour éviter les fuites de mémoire et les bugs
                    btnConfirmerModal.removeEventListener('click', surConfirmation);
                    btnAnnulerModal.removeEventListener('click', surAnnulation);
                    btnRegenererModal.removeEventListener('click', surRegeneration);

                    // Cacher le modal
                    fenetreModale.classList.remove('visible');
                    setTimeout(() => {
                        fenetreModale.style.display = 'none';
                        // Résoudre la promesse APRÈS que tout est nettoyé
                        resolve(valeurRetour);
                    }, 300); // Attendre la fin de l'animation CSS
                };

                // --- Configuration de l'apparence du modal ---
                messageModal.innerHTML = parametres.message;
                conteneurCodeModal.style.display = parametres.afficherCode ? 'block' : 'none';
                btnRegenererModal.style.display = parametres.afficherRegenerer ? 'inline-block' : 'none';
                if (parametres.afficherCode) {
                    affichageCodeModal.textContent = parametres.code || 'N/A';
                }
                btnConfirmerModal.textContent = parametres.texteConfirmer;
                btnConfirmerModal.className = `btn ${parametres.classeConfirmer}`;
                btnAnnulerModal.textContent = parametres.texteAnnuler;

                // --- Attacher les nouveaux écouteurs ---
                // { once: true } est une sécurité supplémentaire qui retire l'écouteur après le premier clic
                btnConfirmerModal.addEventListener('click', surConfirmation, { once: true });
                btnAnnulerModal.addEventListener('click', surAnnulation, { once: true });
                if (parametres.afficherRegenerer) {
                    btnRegenererModal.addEventListener('click', surRegeneration, { once: true });
                }

                // --- Afficher le modal ---
                fenetreModale.style.display = 'flex';
                setTimeout(() => fenetreModale.classList.add('visible'), 10);
            });
        }

        // --- Gestionnaires d'événements ---
        corpsTableau.addEventListener('click', async (e) => {
            const tr = e.target.closest('tr');
            if (!tr) return;
            const emailUtilisateur = tr.dataset.emailUtilisateur;
            const utilisateurCible = listeUtilisateurs.find(u => u.email === emailUtilisateur);
            if (!utilisateurCible) return;

            // --- Clic sur "Visionner" ---
            if (e.target.closest('.btn-voir-code')) {
                if (!utilisateurCible.recovery_code) {
                    afficherNotification("Accès au code de récupération non autorisé pour cet utilisateur.", "warning");
                    return; // On arrête tout ici.
                }

                // Si on a un code, on continue avec la logique du modal...
                const resultat = await afficherModal({
                    message: `Code de récupération pour :<br><strong>${utilisateurCible.email}</strong>`,
                    afficherCode: true, code: utilisateurCible.recovery_code,
                    afficherRegenerer: true,
                    texteConfirmer: 'Copier', classeConfirmer: 'btn-primary',
                    texteAnnuler: 'x',
                });


                if (resultat === true) { // Clic sur "Copier"
                    await navigator.clipboard.writeText(utilisateurCible.recovery_code);
                    afficherNotification(`Code copié dans le presse-papiers !`, 'success', 2000);
                }
                else if (resultat === 'regenerer') { // Clic sur "Régénérer"
                    const adminsProteges = window.PROTECTED_ADMINS || [];
                    if (adminsProteges.includes(utilisateurCible.email)) {
                        afficherNotification("Action impossible : vous ne pouvez pas régénérer le code d'un super-administrateur.", "error");
                        return; // Fin de l'action
                    }

                    // Afficher le modal de confirmation
                    const confirmation = await afficherModal({
                        message: `Voulez-vous vraiment générer un nouveau code pour <br><strong>${utilisateurCible.email}</strong> ?<br><small style="color: #6c757d;">L'ancien code sera invalidé.</small>`,
                        afficherCode: false, afficherRegenerer: false,
                        texteConfirmer: 'Oui, régénérer', classeConfirmer: 'btn-warning',
                        texteAnnuler: 'x'
                    });

                    if (confirmation) { // Si l'utilisateur clique sur "Oui, régénérer"
                        try {
                            const reponse = await fetch(`/admin/api/comptes/${utilisateurCible.email}/regenerate-code`, { method: 'POST' });
                            const resAPI = await reponse.json();
                            if (!reponse.ok) throw new Error(resAPI.erreur);

                            // 1. Mettre à jour l'état local
                            utilisateurCible.recovery_code = resAPI.nouveau_code;

                            // 2. Afficher la notification de succès
                            afficherNotification(resAPI.message, 'success');

                            // 3. IMPORTANT : Rappeler la fonction de clic pour ré-ouvrir le modal principal
                            // Ceci simule un nouveau clic sur "Visionner" pour montrer le code mis à jour.
                            e.target.closest('.btn-voir-code').click();

                        } catch (erreur) {
                            afficherNotification(`Erreur: ${erreur.message}`, 'error');
                        }
                    }
                }
            }
            // Clic sur "Supprimer"
            else if (e.target.closest('.btn-supprimer')) {
                const adminsProteges = window.PROTECTED_ADMINS || [];
                if (adminsProteges.includes(emailUtilisateur)) {
                    afficherNotification("Action impossible : cet utilisateur est protégé.", "error");
                    return;
                }
                const confirmation = await afficherModal({
                    message: `Êtes-vous sûr de vouloir supprimer le compte de <br><strong>${emailUtilisateur}</strong> ?`,
                    afficherCode: false, afficherRegenerer: false,
                    texteConfirmer: 'Supprimer', classeConfirmer: 'btn-danger',
                    texteAnnuler: 'x'
                });
                if (confirmation) {
                    listeUtilisateurs = listeUtilisateurs.filter(u => u.email !== emailUtilisateur);
                    const resultat = await sauvegarderComptes(listeUtilisateurs);
                    if (resultat && resultat.succes) {
                        tr.remove();
                        afficherNotification(`Le compte ${emailUtilisateur} a été supprimé.`, 'success');
                    }
                }
            }
        });

        corpsTableau.addEventListener('change', async (e) => {
            if (!e.target.classList.contains('toggle-actif')) return;
            const interrupteur = e.target;
            const tr = interrupteur.closest('tr');
            const emailUtilisateur = tr.dataset.emailUtilisateur;
            const utilisateurCible = listeUtilisateurs.find(u => u.email === emailUtilisateur);
            if (!utilisateurCible) return;
            const estAdmin = utilisateurCible.role === 'admin';
            const totalAdminsActifs = listeUtilisateurs.filter(u => u.role === 'admin' && u.actif).length;
            if (estAdmin && utilisateurCible.actif && totalAdminsActifs <= 1) {
                afficherNotification("Impossible de désactiver le dernier administrateur actif.", "error");
                interrupteur.checked = true;
                return;
            }
            utilisateurCible.actif = interrupteur.checked;
            const resultat = await sauvegarderComptes(listeUtilisateurs);
            if (resultat && resultat.succes) {
                afficherNotification(`Le statut de ${emailUtilisateur} a été mis à jour.`, "success");
                const badge = tr.querySelector('.cellule-etat span');
                badge.textContent = utilisateurCible.actif ? 'Actif' : 'Inactif';
                badge.className = utilisateurCible.actif ? 'badge-succes' : 'badge-erreur';
            } else {
                interrupteur.checked = !utilisateurCible.actif;
                utilisateurCible.actif = !utilisateurCible.actif;
            }
        });

        formAjouterCompte.addEventListener('submit', async (e) => {
            e.preventDefault();

            // On sélectionne le champ email À L'INTÉRIEUR de cette fonction
            // pour s'assurer qu'il est toujours disponible.
            const champEmail = formAjouterCompte.querySelector('input[name="email"]');
            const email = champEmail.value.trim();
            const role = formAjouterCompte.querySelector('input[name="role"]:checked').value;

            if (!email || !email.includes('@') || listeUtilisateurs.some(u => u.email.toLowerCase() === email.toLowerCase())) {
                afficherNotification("E-mail invalide ou déjà existant.", "warning");
                return;
            }
            const placeholder = { email, role, nom: email.split('@')[0], actif: true, recovery_code: 'GÉNÉRÉ-CÔTÉ-SERVEUR' };
            const listePourEnvoi = [...listeUtilisateurs, placeholder];
            const resultat = await sauvegarderComptes(listePourEnvoi);

            if (resultat && resultat.succes && resultat.nouvel_utilisateur) {
                listeUtilisateurs.push(resultat.nouvel_utilisateur);
                redessinerTableau();
                afficherNotification(resultat.message, "success");
                formAjouterCompte.reset(); // Ceci va vider le champ email
                champEmail.focus(); // On peut garder cette ligne si on veut que le curseur retourne au champ
            }
        });

        // --- Appel initial ---
        chargerComptes();
    }


    // ===================================================================
    // ==== PARTIE 4 : LOGIQUE POUR LA PAGE DE DOCUMENTATION          ====
    // ===================================================================
    const userGuideSection = document.querySelector('.user-guide-section');

    if (userGuideSection) {
        console.log("🚀 Initialisation de la page de DOCUMENTATION...");

        const searchInput = document.getElementById('guide-search-input');
        const guideCards = userGuideSection.querySelectorAll('.guide-card');

        searchInput.addEventListener('input', function (e) {
            const searchTerm = e.target.value.toLowerCase().trim();

            guideCards.forEach(card => {
                const cardTitle = card.querySelector('h3').textContent.toLowerCase();
                const cardText = card.querySelector('p').textContent.toLowerCase();

                // Si le texte de la carte inclut le terme de recherche, on l'affiche. Sinon, on la masque.
                if (cardTitle.includes(searchTerm) || cardText.includes(searchTerm)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // ===================================================================
    // ==== LOGIQUE POUR LA PAGE D'ADMINISTRATION DE LA DOCUMENTATION ====
    // ===================================================================
    const adminDocPage = document.querySelector('.page-admin-doc');

    if (adminDocPage) {
        console.log("🚀 Initialisation de la page d'admin de la documentation...");

        function createCustomSelect_Standard(originalSelect) {
            if (!originalSelect) return;

            // On vérifie si le select a déjà été initialisé pour éviter les doublons
            if (originalSelect.dataset.csInitialized) return;
            originalSelect.dataset.csInitialized = 'true';

            const wrapper = document.createElement('div');
            wrapper.className = 'custom-select-wrapper';
            const trigger = document.createElement('div');
            trigger.className = 'custom-select-trigger';
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'custom-options';

            function updateDisplay() {
                const selectedOption = originalSelect.options[originalSelect.selectedIndex];
                if (selectedOption) {
                    trigger.innerHTML = `<span>${selectedOption.textContent}</span><i class="fas fa-chevron-down arrow"></i>`;
                }
                trigger.classList.toggle('placeholder', !originalSelect.value);
                trigger.classList.toggle('disabled', originalSelect.disabled);

                optionsContainer.innerHTML = '';
                Array.from(originalSelect.options).forEach((optionElement, index) => {
                    const customOption = document.createElement('div');
                    customOption.className = 'custom-option';
                    customOption.textContent = optionElement.textContent;
                    if (optionElement.disabled) customOption.classList.add('disabled');
                    if (optionElement.selected) customOption.classList.add('selected');

                    if (!optionElement.disabled) {
                        customOption.addEventListener('click', () => {
                            originalSelect.selectedIndex = index;
                            originalSelect.dispatchEvent(new Event('change'));
                            wrapper.classList.remove('open');
                        });
                    }
                    optionsContainer.appendChild(customOption);
                });
            }

            originalSelect.addEventListener('change', updateDisplay);
            trigger.addEventListener('click', (e) => {
                if (originalSelect.disabled) return;
                e.stopPropagation();
                document.querySelectorAll('.custom-select-wrapper.open').forEach(openSelect => {
                    if (openSelect !== wrapper) openSelect.classList.remove('open');
                });
                wrapper.classList.toggle('open');
            });

            originalSelect.parentNode.insertBefore(wrapper, originalSelect);
            wrapper.appendChild(originalSelect);
            wrapper.appendChild(trigger);
            wrapper.appendChild(optionsContainer);
            originalSelect.classList.add('original-select');
            updateDisplay();
        }

        const categorySelect = document.getElementById('category-select');
        const subitemSelect = document.getElementById('subitem-select');
        // On vérifie que les données sont disponibles avant de les utiliser
        const fileDropArea = document.querySelector('.file-drop-area');
        const fileInput = document.getElementById('pdf-file-input');
        const fileDropMessage = document.querySelector('.file-drop-message');

        // Éléments pour la barre de progression
        const progressWrapper = document.getElementById('upload-progress-wrapper');
        const progressBar = document.getElementById('upload-progress-bar');
        const progressPercent = document.getElementById('upload-progress-percent');
        const progressFilename = document.querySelector('.progress-filename');



        // On appelle la bonne version de la fonction
        createCustomSelect_Standard(categorySelect);
        createCustomSelect_Standard(subitemSelect);

        if (!categorySelect || !subitemSelect || !fileDropArea) {
            console.error("Un ou plusieurs éléments essentiels de la page d'admin sont manquants.");
            return; // On arrête l'exécution pour éviter d'autres erreurs
        }

        // 1. Gérer les menus déroulants dynamiques
        categorySelect.addEventListener('change', () => {
            const selectedCategorySlug = categorySelect.value;
            subitemSelect.innerHTML = ''; // Vider les options

            if (selectedCategorySlug && guidesDataForJS[selectedCategorySlug]) {
                subitemSelect.add(new Option('-- Choisir un document --', '', true, true));
                subitemSelect.options[0].disabled = true;

                const subItems = guidesDataForJS[selectedCategorySlug].sub_items;
                for (const slug in subItems) {
                    subitemSelect.add(new Option(subItems[slug].title, slug));
                }
                subitemSelect.disabled = false;
            } else {
                subitemSelect.add(new Option('-- D\'abord choisir une catégorie --', '', true, true));
                subitemSelect.options[0].disabled = true;
                subitemSelect.disabled = true;
            }

            // Forcer la mise à jour de l'UI du custom-select
            subitemSelect.dispatchEvent(new Event('change'));

            const subitemTrigger = subitemSelect.closest('.custom-select-wrapper').querySelector('.custom-select-trigger');
            if (subitemTrigger) {
                subitemTrigger.classList.toggle('disabled', subitemSelect.disabled);
            }
        });
        // 4. LOGIQUE DE TÉLÉVERSEMENT (DRAG & DROP ET INPUT)

        /**
     * Traite le fichier déposé ou sélectionné :
     * - validation de la sous-catégorie
     * - mise à jour de l'affichage
     * - simulation de progression via FileReader
     */
        function handleFile(file) {
            // Validation : s'assurer qu'un document est sélectionné
            if (!subitemSelect.value) {
                alert('Veuillez sélectionner d’abord un document.');
                resetUploadUI();
                return;
            }

            // Mise à jour du message et masquage de l'icône
            fileDropMessage.textContent = `Fichier sélectionné : ${file.name}`;
            document.querySelector('.file-drop-icon').style.display = 'none';

            // Affichage de la barre de progression
            progressWrapper.style.display = 'block';
            progressFilename.textContent = file.name;
            progressBar.value = 0;
            progressPercent.textContent = '0%';

            // Lecture du fichier pour déclencher l'événement progress
            const reader = new FileReader();
            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const p = Math.round((e.loaded / e.total) * 100);
                    progressBar.value = p;
                    progressPercent.textContent = `${p}%`;
                }
            };
            reader.onloadend = () => {
                progressBar.value = 100;
                progressPercent.textContent = 'Prêt';
            };
            reader.onerror = () => {
                alert('Erreur lors de la lecture du fichier.');
                resetUploadUI();
            };
            reader.readAsArrayBuffer(file);
        }

        // Fonction pour réinitialiser l'UI de téléversement
        function resetUploadUI() {
            fileInput.value = '';
            fileDropMessage.innerHTML = 'Glissez-déposez votre fichier ici, ou <span class="file-browse-link">parcourez</span>';
            document.querySelector('.file-drop-icon').style.display = 'block';
            progressWrapper.style.display = 'none';
        }

        // -------------------------------------------------------------------
        // ÉVITER LES COMPORTEMENTS PAR DÉFAUT DU NAVIGATEUR
        // -------------------------------------------------------------------
        // Événements de Drag & Drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, () => fileDropArea.classList.add('is-dragover'));
        });
        ['dragleave', 'drop'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, () => fileDropArea.classList.remove('is-dragover'));
        });

        fileDropArea.addEventListener('drop', e => {
            const f = e.dataTransfer.files[0];
            if (f) {
                fileInput.files = e.dataTransfer.files;  // Remplit l'input file caché
                handleFile(f);
            }
        });

        // Événement pour le clic sur "parcourez"
        const fileBrowseLink = fileDropArea.querySelector('.file-browse-link');
        if (fileBrowseLink) {
            fileBrowseLink.addEventListener('click', () => fileInput.click());
        }

        // Événement quand un fichier est choisi via la boîte de dialogue
        fileInput.addEventListener('change', () => {
            const f = fileInput.files[0];
            if (f) handleFile(f);
        });
    }

    // ===================================================================
    // ==== PARTIE 5 : LOGIQUE POUR LA PAGE DES REQUÊTES AVANCÉES (CARTES)
    // ===================================================================

    // On cherche l'élément principal de la page de sélection des cartes.
    const containerCartes = document.getElementById("cartes-container");

    // SI et SEULEMENT SI cet élément existe, on exécute le code correspondant.
    if (containerCartes) {
        const inputRecherche = document.getElementById("search-titre");
        const radiosType = document.querySelectorAll('input[name="type_transaction"]');

        const requetes = [];

        // Charge les requêtes selon le type (ventes ou achats)
        function chargerRequetes(type) {
            const chemin = `${STATIC_URL}data_demo/${type}_requetes_avancees.json`;

            fetch(chemin)
                .then(res => res.json())
                .then(data => {
                    requetes.length = 0; // Réinitialise le tableau
                    requetes.push(...data);
                    if (inputRecherche) { // Sécurité supplémentaire
                        afficherCartes(inputRecherche.value);
                    }
                })
                .catch(err => {
                    console.error(`Erreur lors du chargement de ${chemin} :`, err);
                    containerCartes.innerHTML = "<p class='message-erreur'>Erreur lors du chargement des requêtes.</p>";
                });
        }

        // Crée une carte HTML
        function creerCarte(requete) {
            const carte = document.createElement("div");
            carte.className = "carte-requete";
            carte.dataset.titre = requete.titre.toLowerCase();

            carte.innerHTML = `
            <h3>${requete.titre}</h3>
            <p>${requete.description}</p>
            <button class="btn-executer" data-id="${requete.id}">
                <i class="fas fa-bolt"></i> Exécuter
            </button>
        `;
            return carte;
        }

        // Affiche les cartes filtrées
        function afficherCartes(filtre = "") {
            containerCartes.innerHTML = "";
            const texte = filtre.toLowerCase();

            requetes.forEach(requete => {
                if (requete.titre.toLowerCase().includes(texte)) {
                    containerCartes.appendChild(creerCarte(requete));
                }
            });
        }

        // Filtrage texte (avec une sécurité)
        if (inputRecherche) {
            inputRecherche.addEventListener("input", (e) => {
                afficherCartes(e.target.value);
            });
        }

        // Écoute des changements de radio
        radiosType.forEach(radio => {
            radio.addEventListener("change", () => {
                if (radio.checked) {
                    chargerRequetes(radio.value);
                }
            });
        });

        // Chargement initial par défaut : ventes
        chargerRequetes("ventes");

        // Gestion du clic sur "Exécuter" → redirection vers la page de filtres
        containerCartes.addEventListener("click", (e) => {
            const bouton = e.target.closest(".btn-executer");
            if (!bouton) return;

            const id = bouton.dataset.id;
            const type = document.querySelector('input[name="type_transaction"]:checked')?.value || "ventes";

            // Redirection vers le formulaire dynamique
            window.location.href = `/cartes-requete-avancee/filtres-requete-avancee?type=${type}&id=${id}`;
        });
    }

    // ===================================================================
    // ==== PARTIE 6 : LOGIQUE POUR LE FORMULAIRE DE REQUÊTES AVANCÉES ===
    // ===================================================================
    const formulaireAvancee = document.getElementById("formulaire-requete-avancee");

    if (formulaireAvancee) {
        formulaireAvancee.addEventListener("submit", async (e) => {
            e.preventDefault();

            const formData = new FormData(formulaireAvancee);
            const nom_fonction = formData.get("nom_fonction");

            // 1. Dates obligatoires
            const filtres = {
                start_year: formData.get("start_year") || undefined,
                end_year: formData.get("end_year") || undefined,
            };

            // 2. Champs optionnels
            // on récupère les tableaux des clés/valeurs
            const fields = formData.getAll("field[]");
            const values = formData.getAll("value[]");
            for (let i = 0; i < fields.length; i++) {
                const key = fields[i];
                const val = values[i].trim();
                if (key && val) {
                    filtres[key] = val;
                }
            }

            try {
                const res = await fetch("/api/requete-avancee", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nom_fonction, filtres })
                });
                if (!res.ok) throw new Error("Erreur lors de l’appel RPC");
                const data = await res.json();

                // stock & redirige comme avant
                localStorage.setItem("resultats_requete_avancee", JSON.stringify(data));
                localStorage.setItem("type_transaction", formulaireAvancee.dataset.type || "ventes");
                window.location.href = "/filtre-requete-avancee/resultat-requete-avancee";
            } catch (err) {
                console.error("Erreur RPC :", err);
                alert("Erreur lors de l’exécution de la requête.");
            }
        });
    }


    // ===================================================================
    // ==== PARTIE 7 : LOGIQUE POUR LA PAGE DE FILTRES AVANCÉS         ====
    // ===================================================================
    // On identifie la page grâce au data-attribute sur le body
    const bodyFiltresAvances = document.querySelector('body[data-page="filtres-avances"]');

    if (bodyFiltresAvances) {
        console.log("🚀 Initialisation de la page de filtres avancés...");

        // 1. Sélecteurs de la période
        const syAdv = document.getElementById('start_year');
        const smVisAdv = document.getElementById('start_month_visible');
        const smAdv = document.getElementById('start_month');
        const eyAdv = document.getElementById('end_year');
        const emVisAdv = document.getElementById('end_month_visible');
        const emAdv = document.getElementById('end_month');

        // 2. Créer et attacher le picker de mois
        const attacherSelecteurAdv = creerSelecteurMois();
        attacherSelecteurAdv(smVisAdv, syAdv, smAdv);
        attacherSelecteurAdv(emVisAdv, eyAdv, emAdv);

        // 3. Synchroniser et valider le mois numérique
        synchroniserMois(smVisAdv, smAdv);
        synchroniserMois(emVisAdv, emAdv);

        // 4. Lier les champs de date pour la période   
        lierAnneeMois(syAdv, smVisAdv, smAdv);
        lierAnneeMois(eyAdv, emVisAdv, emAdv);

        // --- Clés et Constantes ---
        const requeteId = bodyFiltresAvances.dataset.requeteId;
        const requeteType = bodyFiltresAvances.dataset.requeteType;
        const STORAGE_KEY_AV = `filtres_requete_${requeteId}`;
        const container = document.getElementById('fields-container');
        const form = document.getElementById('form-advanced');
        const champsDisponibles = window.CHAMPS_FILTRABLES || [];

        // --- Fonctions de gestion d'état ---
        function sauvegarderFiltresAvances() {
            const filtres = Array.from(container.querySelectorAll('.field-row'))
                .map(row => ({
                    field: row.querySelector('select[name="field[]"]')?.value,
                    operator: row.querySelector('select[name="operator[]"]')?.value,
                    value: row.querySelector('input[name="value[]"]')?.value.trim()
                }))
                .filter(f => f.field || f.value);

            localStorage.setItem(STORAGE_KEY_AV, JSON.stringify(filtres));
        }

        function reinitialiserInterfaceFiltres() {
            container.innerHTML = '';
            if (champsDisponibles.length > 0) {
                addFieldRow(champsDisponibles, container, true);
            } else {
                container.innerHTML = "<p class='no-filters-message'>Cette requête ne nécessite aucun filtre supplémentaire.</p>";
            }
        }

        function restaurerOuInitialiser() {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_AV) || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                container.innerHTML = '';
                saved.forEach(f => {
                    const row = addFieldRow(champsDisponibles, container, true);
                    row.querySelector('select[name="field[]"]').value = f.field;
                    row.querySelector('select[name="operator[]"]').value = f.operator;
                    row.querySelector('input[name="value[]"]').value = f.value;
                    row.querySelector('select[name="field[]"]').dispatchEvent(new Event('change'));
                    row.querySelector('select[name="operator[]"]').dispatchEvent(new Event('change'));
                });
                // Toujours une ligne vide à la fin
                const lastVal = container.querySelector('.field-row:last-child input[name="value[]"]').value;
                if (lastVal) addFieldRow(champsDisponibles, container, true);
            } else {
                reinitialiserInterfaceFiltres();
            }
        }

        // --- Initialisation au chargement de la page ---
        restaurerOuInitialiser();

        // --- DÉLÉGATION POUR LE BOUTON “×” DE LA PÉRIODE AVANCÉE ---
        const controlesPeriode = bodyFiltresAvances.querySelector('.period-layout__controls');
        if (controlesPeriode) {
            controlesPeriode.addEventListener('click', e => {
                if (!e.target.classList.contains('clear-period-btn')) return;
                // On vide la période
                syAdv.value = '';
                smVisAdv.value = '';
                smAdv.value = '';
                eyAdv.value = '';
                emVisAdv.value = '';
                emAdv.value = '';
                syAdv.dispatchEvent(new Event('input'));
                eyAdv.dispatchEvent(new Event('input'));
            });
        }

        // Sauvegarder la dernière requête visitée pour reload
        localStorage.setItem('derniere_requete_avancee', JSON.stringify({
            id: requeteId,
            type: requeteType
        }));
    }

    // Cette variable est créée par le code Jinja2 dans le template HTML.
    if (window.flashedMessages && window.flashedMessages.length > 0) {

        // Si c'est le cas, on parcourt chaque message qui a été reçu du backend.
        window.flashedMessages.forEach(flash => {

            // On utilise VOTRE PROPRE fonction 'afficherNotification' pour montrer le message.
            // Cela garantit un style visuel cohérent sur toute l'application.
            afficherNotification(flash.message, flash.category, 5000); // Durée de 5 secondes
        });
    }

    // ===================================================================
    // ==== PARTIE 8 : VALIDATION EN TEMPS RÉEL DU MOT DE PASSE       ====
    // ===================================================================
    // On cible le champ de saisie du nouveau mot de passe
    const champMotDePasse = document.getElementById('new_password');

    // Si ce champ existe sur la page...
    if (champMotDePasse) {
        console.log("🚀 Initialisation du validateur de mot de passe en temps réel.");

        // On sélectionne tous les éléments de la liste de critères
        const criteres = {
            longueur: document.getElementById('critere-longueur'),
            minuscule: document.getElementById('critere-minuscule'),
            majuscule: document.getElementById('critere-majuscule'),
            chiffre: document.getElementById('critere-chiffre'),
            special: document.getElementById('critere-special')
        };

        // On écoute l'événement 'input', qui se déclenche à chaque fois que l'utilisateur tape une lettre
        champMotDePasse.addEventListener('input', () => {
            const password = champMotDePasse.value;

            // Fonction pour mettre à jour l'UI d'un critère
            const validerCritere = (element, condition) => {
                const icone = element.querySelector('i');
                if (condition) {
                    element.classList.add('valide');
                    icone.classList.remove('fa-times-circle');
                    icone.classList.add('fa-check-circle');
                } else {
                    element.classList.remove('valide');
                    icone.classList.remove('fa-check-circle');
                    icone.classList.add('fa-times-circle');
                }
            };

            // On vérifie chaque critère avec des expressions régulières
            validerCritere(criteres.longueur, password.length >= 8);
            validerCritere(criteres.minuscule, /[a-z]/.test(password));
            validerCritere(criteres.majuscule, /[A-Z]/.test(password));
            validerCritere(criteres.chiffre, /[0-9]/.test(password));
            validerCritere(criteres.special, /[!@#$%^&*(),.?:{}|<>]/.test(password));
        });
    }

    // ===================================================================
    // ==== PARTIE 9 : LOGIQUE POUR LA PAGE DE PROFIL ====
    // ===================================================================
    const pageProfil = document.querySelector('.page-profil');
    if (pageProfil) {
        console.log("🚀 Initialisation de la page de PROFIL.");

        const btnCopier = document.getElementById('btn-copy-code');
        const btnRegenerer = document.getElementById('btn-regenerate-code');
        const codeDisplay = document.getElementById('recovery-code-display');

        // --- Logique pour copier le code ---
        btnCopier.addEventListener('click', async () => {
            if (codeDisplay.textContent && codeDisplay.textContent !== 'N/A') {
                await navigator.clipboard.writeText(codeDisplay.textContent);
                afficherNotification('Code copié dans le presse-papiers !', 'success', 2000);
            }
        });

        // --- Logique pour régénérer le code ---
        btnRegenerer.addEventListener('click', async () => {
            // On utilise le même modal de confirmation que sur la page admin
            const modal = document.getElementById('modal-confirmation');
            const modalMessage = document.getElementById('modal-message');
            const btnAnnuler = document.getElementById('btn-modal-annuler');
            const btnConfirmer = document.getElementById('btn-modal-confirmer');

            // Configurer et afficher le modal
            modalMessage.innerHTML = "Voulez-vous vraiment générer un nouveau code ?<br><small>L'ancien code sera définitivement invalidé.</small>";
            btnConfirmer.textContent = "Oui, régénérer";
            btnConfirmer.className = 'btn btn-warning';
            btnAnnuler.textContent = "Annuler";
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('visible'), 10);

            const confirmation = await new Promise(resolve => {
                const onConfirm = () => resolve(true);
                const onCancel = () => resolve(false);
                btnConfirmer.addEventListener('click', onConfirm, { once: true });
                btnAnnuler.addEventListener('click', onCancel, { once: true });
            });

            // Fermer le modal
            modal.classList.remove('visible');
            setTimeout(() => modal.style.display = 'none', 300);

            // Si l'utilisateur a confirmé
            if (confirmation) {
                try {
                    const reponse = await fetch('/api/profil/regenerate-code', { method: 'POST' });
                    const resultat = await reponse.json();
                    if (!reponse.ok) throw new Error(resultat.erreur);

                    // Mettre à jour l'affichage avec le nouveau code
                    codeDisplay.textContent = resultat.nouveau_code;
                    afficherNotification(resultat.message, 'success');

                } catch (erreur) {
                    afficherNotification(`Erreur : ${erreur.message}`, 'error');
                }
            }
        });
    }


});


