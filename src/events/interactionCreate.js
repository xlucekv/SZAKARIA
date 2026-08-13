} else if (interaction.isButton()) {
          // Bezpośrednia obsługa zamykania ticketu
          if (interaction.customId.startsWith('ticket_close') || interaction.customId.startsWith('close_ticket')) {
            try {
              const closeHandler = await import('../interactions/buttons/ticket/ticketClose.js');
              return await closeHandler.default.execute(interaction, client);
            } catch (err) {
              // Jeśli powyższy plik nie istnieje, usuwamy po prostu kanał po 3 sekundach:
              await interaction.reply({ content: '🔒 Zgłoszenie zostanie zamknięte za 3 sekundy...' });
              setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
              return;
            }
          }

          if (interaction.customId.startsWith('shared_todo_')) {
            const parts = interaction.customId.split('_');
            const buttonType = parts.slice(0, 3).join('_');
            const listId = parts[3];
            const button = client.buttons.get(buttonType);

            if (button) {
              try {
                await button.execute(interaction, client, [listId]);
              } catch (error) {
                await handleInteractionError(interaction, error, withTraceContext({
                  type: 'button',
                  customId: interaction.customId,
                  handler: 'todo'
                }, interactionTraceContext));
              }
            } else {
              throw createError(
                `No button handler found for ${buttonType}`,
                ErrorTypes.CONFIGURATION,
                'This button is not available.',
                withTraceContext({ buttonType }, interactionTraceContext)
              );
            }
            return;
          }

          const [customId, ...args] = interaction.customId.split(':');
          const button = client.buttons.get(customId);

          if (!button) {
            if (!interaction.customId.includes(':') || isCollectorManagedComponent(customId)) {
              return;
            }

            throw createError(
              `No button handler found for ${customId}`,
              ErrorTypes.CONFIGURATION,
              'This button is not available.',
              withTraceContext({ customId }, interactionTraceContext)
            );
          }

          try {
            await button.execute(interaction, client, args);
          } catch (error) {
            await handleInteractionError(interaction, error, withTraceContext({
              type: 'button',
              customId: interaction.customId,
              handler: 'general'
            }, interactionTraceContext));
          }
        }
