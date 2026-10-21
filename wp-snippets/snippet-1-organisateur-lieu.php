<?php
/**
 * Snippet ADW 1 — Modules 1 & 2 du futur plugin « atelierduweb-mec-api »
 * Organisateur + Lieu des événements M.E. Calendar via l'API REST publique WP.
 *
 * ⚠️ Snippet de TEST pour Code Snippets (site en production) :
 *   - Lecture seule : n'écrit rien en base, ne touche pas au front du site.
 *   - Accroché UNIQUEMENT à « rest_api_init » : si le code échoue, il échoue
 *     au moment d'un appel API (réponse 500 sur ce seul endpoint), sans
 *     impact sur l'affichage du site ni sur l'admin.
 *   - Aucune dépendance : fonctionne même si M.E. Calendar est désactivé
 *     (renvoie « null » proprement dans ce cas).
 *
 * Installation : Code Snippets → Add New → coller ce fichier entier →
 * « Only run in administration area » DÉCOCHÉ, « Run snippet everywhere »
 * n'a aucun effet de bord front (le hook ne s'exécute que sur l'API REST).
 *
 * Test après activation :
 *   https://atelierduweb.be/wp-json/wp/v2/mec-events?per_page=1&_fields=id,title,mec_organizer,mec_location
 * Les deux nouveaux objets doivent apparaître dans la réponse JSON.
 *
 * Version : 1.0.0 (tracée dans la réponse pour vérifier le cache API).
 */

if (!defined('ABSPATH')) {
    return;
}

define('ADW_MECAPI_SNIPPET_1_VERSION', '1.0.0');

add_action('rest_api_init', function () {
    // Module 1 — Organisateur
    register_rest_field('mec-events', 'mec_organizer', array(
        'get_callback' => 'adw_mecapi_snippet1_get_organizer',
        'schema' => array(
            'description' => 'Organisateur de l\'événement (Atelier du Web — module 1).',
            'type' => 'object',
        ),
    ));

    // Module 2 — Lieu
    register_rest_field('mec-events', 'mec_location', array(
        'get_callback' => 'adw_mecapi_snippet1_get_location',
        'schema' => array(
            'description' => 'Lieu de l\'événement (Atelier du Web — module 2).',
            'type' => 'object',
        ),
    ));

    // Champ de version (diagnostic : confirme que le snippet est bien actif)
    register_rest_field('mec-events', 'adw_snippet1_version', array(
        'get_callback' => function () {
            return ADW_MECAPI_SNIPPET_1_VERSION;
        },
        'schema' => array(
            'description' => 'Version du snippet ADW actif sur ce site.',
            'type' => 'string',
        ),
    ));
});

/**
 * Module 1 — Organisateur : postmeta « mec_organizer_id » → terme MEC.
 * Retourne null si l'événement n'a pas d'organisateur (jamais d'erreur).
 */
function adw_mecapi_snippet1_get_organizer($post_arr) {
    $post_id = isset($post_arr['id']) ? (int) $post_arr['id'] : 0;
    if (!$post_id) {
        return null;
    }

    $organizer_id = (int) get_post_meta($post_id, 'mec_organizer_id', true);
    if (!$organizer_id) {
        return null;
    }

    $term = get_term($organizer_id);
    if (!$term || is_wp_error($term) || !isset($term->term_id)) {
        return null;
    }

    return array(
        'id' => (int) $term->term_id,
        'name' => $term->name,
        'email' => (string) get_term_meta($term->term_id, 'email', true),
        'tel' => (string) get_term_meta($term->term_id, 'tel', true),
        'website' => (string) get_term_meta($term->term_id, 'website', true),
    );
}

/**
 * Module 2 — Lieu : postmeta « mec_location_id » → terme MEC.
 * Retourne null si l'événement n'a pas de lieu (jamais d'erreur).
 */
function adw_mecapi_snippet1_get_location($post_arr) {
    $post_id = isset($post_arr['id']) ? (int) $post_arr['id'] : 0;
    if (!$post_id) {
        return null;
    }

    $location_id = (int) get_post_meta($post_id, 'mec_location_id', true);
    if (!$location_id) {
        return null;
    }

    $term = get_term($location_id);
    if (!$term || is_wp_error($term) || !isset($term->term_id)) {
        return null;
    }

    return array(
        'id' => (int) $term->term_id,
        'name' => $term->name,
        'address' => (string) get_term_meta($term->term_id, 'address', true),
        'website' => (string) get_term_meta($term->term_id, 'website', true),
    );
}
