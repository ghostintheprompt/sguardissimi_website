---
template: article
title: Cosa rivelano davvero i tuoi file RAW
date: '2026-02-04'
categories:
  - technical-insight
excerpt: >-
  Ogni file RAW di uno shooting moda contiene molto più dei pixel. Metadati EXIF con seriale della camera, coordinate GPS, dati dell'obiettivo. Profili colore ICC. Anteprime incorporate. File da 50 MB mandati a retoucher, agenzie, clienti. Molti fotografi non puliscono nulla. Chi fa sicurezza sfrutta tutto.
author: Michael d Subrizi
photographer: Michael d Subrizi
word_count: 676
reading_time: 3
featured: false
---

# Cosa rivelano davvero i tuoi file RAW

Ogni shooting moda genera centinaia di file RAW. Più di 50 MB per immagine. Canon CR2, Nikon NEF, Sony ARW.

Vanno ovunque. WeTransfer ai retoucher. Email ai clienti. Cloud storage per le agenzie. Import nei DAM che leggono i metadati in automatico.

Molti fotografi sanno che i RAW incorporano le impostazioni di scatto. ISO, diaframma, tempo, tutto visibile in Lightroom.

**Quello che in pochi capiscono e questo: i file RAW sono una superficie d'attacco.**

## Cosa c'e davvero dentro

Oltre alle impostazioni più ovvie:

**Identificazione della fotocamera:**
- Numero di serie
- Versione firmware
- Seriale dell'obiettivo in alcuni sistemi

**Dati di posizione:**
- Coordinate GPS, se la camera le registra
- Nomi dei luoghi dai database interni
- Informazioni sul fuso orario

**Istruzioni di elaborazione:**
- Profili colore personalizzati
- Picture style della camera
- Stringhe di copyright copiate da lavori precedenti

**Anteprime incorporate:**
- Preview JPEG completa
- Cache thumbnail
- Anteprima usata dal display della camera

**Timestamp:**
- Ora originale di scatto
- Ora di modifica del file
- Differenze tra fuso e ora locale

## Perché i fotografi moda sono bersagli

La moda di fascia alta genera:
- Trasferimenti enormi di file
- Catene di fiducia
- Elaborazione automatica
- Contenuti di valore
- Dati economici e contratti nelle stesse cartelle

**Scenario reale:**

Backstage da Elie Saab. Trecento RAW. Trasferiti a un retoucher a Parigi. Il retoucher importa tutto in Capture One. Il parser dei RAW legge i metadati.

Uno di quei file? Preparato apposta.

Si attiva una vulnerabilita del parser. Viene aperto un accesso remoto. L'intero shooting, insieme al database clienti, può uscire prima che qualcuno se ne accorga.

Non e fantascienza. Questa superficie d'attacco esiste ovunque le immagini vengano processate in automatico.

## Cosa si espone davvero

Lo zio Rob fotografava Già, Rachel, Christie Brinkley. Era pellicola. Niente metadati. Solo stampe fisiche.

Il digitale ha cambiato tutto.

**Workflow moda contemporaneo:**
1. Scatti dietro le quinte
2. Trasferisci i RAW
3. Il retoucher importa e processa
4. L'agenzia riceve i finali
5. Il cliente archivia e indicizza
6. Le immagini escono su social, web, stampa

**Ogni passaggio e un parser. Ogni parser e un possibile exploit.**

Il seriale della camera in ogni file? Identifica l'attrezzatura e aiuta anche chi ruba.

Le coordinate GPS incorporate? Rivelano studio, hotel, spostamenti durante le settimane della moda.

I profili ICC? Possono portarsi dietro dati nascosti oltre al colore.

Le preview incorporate? A volte contengono versioni precedenti che pensavi di aver eliminato.

## Moda e tecnologia, davvero insieme

Non e paranoia. E realtà per chiunque lavori immagini su scala vera.

[Ghost in the Prompt](https://ghostintheprompt.com) entra nei dettagli tecnici: metadata injection, steganografia, parser exploit, vettori d'attacco nei file RAW.

**Gli stessi file che documentano il mestiere possono documentare anche la tua infrastruttura.**

Non è un invito ad attaccare i fotografi moda. È un invito a capire dove stai mettendo le mani.

## Cosa fare davvero

**Prima di spedire file fuori dal tuo controllo:**

Pulisci i metadati superflui:
- Coordinate GPS
- Seriali della camera
- Profili ICC custom non necessari
- Anteprime incorporate

**Strumenti che servono davvero:**
- ExifTool
- Impostazioni export di Lightroom
- Profili export di Capture One

**Per la consegna ai clienti:**

Esporta JPEG lavorati, non RAW originali:
- File più leggeri
- Meno dati esposti
- Più controllo sui metadati
- Originali offline

**Per i rapporti con agenzie e retoucher:**

Usa trasferimenti cifrati dove puoi:
- zip cifrati con password
- SFTP invece di FTP semplice
- URL firmati con scadenza

La fiducia e reale. La sicurezza e un'altra cosa.

## La realtà della moda

Ho fotografato più di duecento sfilate. Tre città. Dietro le quinte con Stella McCartney, Thom Browne, Ackermann. Migliaia di file RAW.

Non ho mai avuto un incidente. Non ho mai pensato che fosse impossibile.

È la stessa disciplina con cui pulisci il sensore e controlli il vetro. Togli i metadati. Non per paranoia, per mestiere.

Il lavoro professionale comprende anche la protezione del lavoro.

---

Scattare e mentalita. Viaggio psichedelico. Sacrificio agli dei, ai maestri, alle ispirazioni, al momento.

**Significa anche proteggere quel momento dopo lo scatto.**

Il rispetto per il mestiere include anche il rispetto per i dati.

---

*Per i dettagli tecnici, vedi: [Image Payload Injection](https://ghostintheprompt.com/articles/image-payload-injection) su Ghost in the Prompt*

*Tutte le immagini © Michael d Subrizi / Sguardissimi*
