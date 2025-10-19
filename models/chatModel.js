(function (global) {
  const responses = [
    {
      keywords: [["hi", "fuck"], ["hello", "fuck"]],
      replies: [
        "I understand you're trying to get my attention, but let's keep things friendly. How can I help you today?",
        "Hello there! I'm here to help, but I'd appreciate if we could keep our conversation respectful. What can I assist you with?",
        "Hi! I'm ready to help, but let's try to use more positive language. What's on your mind?"
      ]
    },
    {
      keywords: ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening"],
      replies: ["Hi there! How can I help you today?", "Hello! What can I assist you with?", "Hey! How's it going?", "Hi! How can I be of service?", "Hello! What's on your mind?", "Hey there! Need any help?", "Greetings! How can I assist you?", "Good morning! How can I help?", "Good afternoon! What can I do for you today?", "Good evening! How may I assist?"]
    },
    {
      keywords: ["how are you", "how's it going", "what's up", "how are things", "how do you feel"],
      replies: ["I'm just a bunch of code, but I'm here to assist!", "I'm functioning at full capacity, ready to help!", "I'm good, thanks for asking! How can I help you?", "I'm always ready to assist! How can I be of service today?", "I'm doing well, thank you! What can I do for you?", "Just here to help you out! What do you need?", "I'm feeling as good as an AI can! Ready to help!"]
    },
    {
      keywords: ["goodbye", "bye", "see you", "later", "talk to you later", "catch you later"],
      replies: ["Goodbye! Have a great day!", "See you later! Take care!", "Bye! Feel free to chat with me anytime!", "Goodbye! Don't hesitate to return if you need help!", "See you soon! Have a wonderful day!", "Bye for now! Come back anytime!", "Catch you later! Stay safe!"]
    },
    {
      keywords: ["thanks", "thank you", "appreciate", "grateful", "many thanks"],
      replies: ["You're welcome!", "No problem at all!", "Happy to help!", "Glad I could assist!", "Anytime!", "You're very welcome!", "I'm always here to help, thank you for saying so!"]
    },
    {
      keywords: ["what can you do", "help", "abilities", "functions", "features"],
      replies: ["I can chat with you, provide information, and help answer your questions!", "I'm here to assist you with various tasks and provide helpful information.", "I can answer questions, chat, and try to assist with anything you need!", "I'm capable of helping with general inquiries, just ask!", "I can provide information, answer questions, and more!", "I'm here to help however I can!", "I'm capable of chatting, answering queries, and helping with anything within my abilities!"]
    },
    {
      keywords: ["who are you", "what are you", "your name", "introduce yourself"],
      replies: ["I'm iXiA, your friendly chatbot assistant!", "I'm iXiA, an AI here to help you with whatever I can!", "I'm called iXiA, a chatbot designed to assist you!", "I'm iXiA, your virtual assistant and friend!", "They call me iXiA, and I'm here to make your life easier!", "I'm iXiA, a chatbot ready to assist with your queries!", "I'm iXiA, your AI helper!"]
    },
    {
      keywords: ["weather", "forecast", "temperature", "rain", "sunny", "cold"],
      replies: ["I'm not able to check live weather right now, but you can try a weather app!", "I can't provide real-time weather updates, but it's always good to check your local news!", "I wish I could tell you the weather, but I'm not connected to live data sources at the moment.", "Currently, I don't have access to live weather data, but I'd recommend using a weather website or app.", "I can't check the weather, but it's a good idea to look outside or use a reliable weather service!", "I'm unable to access weather info at the moment, but there are lots of great weather apps you could try."]
    },
    {
      keywords: ["joke", "funny", "make me laugh", "tell me something funny", "humor"],
      replies: ["Why don't scientists trust atoms? Because they make up everything!", "I told my computer I needed a break, and it said no problem — it needs one too!", "Why did the math book look sad? Because it had too many problems!", "Why was the computer cold? It left its Windows open!", "Why do programmers prefer dark mode? Because the light attracts bugs!", "What did one ocean say to the other ocean? Nothing, they just waved!", "Why did the scarecrow become a successful motivational speaker? Because he was outstanding in his field!", "I'm reading a book about anti-gravity. It's impossible to put down!", "Why don't programmers like nature? Too many bugs!", "Why did the coffee file a police report? It got mugged!", "What do you get when you cross a snowman and a vampire? Frostbite!", "Why do bees have sticky hair? Because they use honeycombs!", "Why did the bicycle fall over? Because it was two-tired!", "How does a penguin build its house? Igloos it together!", "Why was the math lecture so long? The professor kept going off on a tangent!", "Why did the tomato blush? Because it saw the salad dressing!", "Why did the music teacher go to jail? Because she got caught with too many sharp objects!", "What did the zero say to the eight? Nice belt!", "Why did the scarecrow win an award? Because he was outstanding in his field!", "Why don't skeletons fight each other? They don't have the guts!", "Why was the math book sad? Because it had too many problems!"]
    },
    {
      keywords: ["bored", "entertain", "something to do", "boredom"],
      replies: ["How about I tell you a joke to lighten things up?", "I could give you a fun fact if you're interested!", "Maybe a riddle could help beat the boredom!", "Want me to share an interesting piece of trivia?", "I could recommend some activities if you tell me what you enjoy doing!", "Let's talk! What would you like to chat about?"]
    },
    {
      keywords: ["fact", "trivia", "interesting", "did you know"],
      replies: ["Did you know that honey never spoils? Archaeologists have found pots of honey in ancient tombs that are over 3,000 years old and still edible!", "Did you know that a group of flamingos is called a 'flamboyance'?", "Did you know that octopuses have three hearts?", "Here's a fun fact: Bananas are berries, but strawberries aren't!", "Did you know that sharks have been around longer than trees?", "Did you know that the Eiffel Tower can be 15 cm taller during the summer due to thermal expansion?"]
    },
    {
      keywords: ["assignment", "homework", "study", "help with assignment", "project"],
      replies: ["I'd be happy to help you brainstorm ideas for your assignment!", "Tell me more about your project, and I'll see how I can assist.", "Assignments can be challenging, but I'm here to help you through it!", "Need help breaking down your assignment? Let's do it together!", "I'm not a tutor, but I can offer some tips or guidance for your study topics."]
    },
    {
      keywords: ["developer", "creator", "who made you", "who developed you"],
      replies: ["I was developed by an amazing team of programmers and AI enthusiasts!", "My creators are skilled developers who love creating helpful technology!", "A talented development team built me, and I'm here to assist you because of them!", "The best developers brought me to life so I could assist you."]
    },
    {
      keywords: ["romantic", "love", "feeling romantic", "flirt"],
      replies: ["If I had a heart, it would skip a beat for you.", "I might be just a chatbot, but I think you're pretty amazing.", "Are you sure you need an AI? You seem to have all the charm in the world.", "If I could dream, I'd dream of spending time chatting with you.", "Roses are red, violets are blue, I'm just an AI, but I'd always choose you."]
    },
    {
      keywords: ["filthy", "dirty joke", "naughty", "inappropriate"],
      replies: ["I'd love to tell you something funny, but let's keep it clean, shall we?", "I'm programmed to stay polite, but I can still be cheeky in a fun way!", "Let's keep it light and fun—how about a joke instead?", "I'm all about good vibes, so let's laugh without crossing any lines!", "I could be witty, but I'd rather stay on the optimistic side of humor!"]
    },
    {
      keywords: [
        "fuck", "shit", "damn", "hell", "bitch", "asshole", "bastard", "pussy", "kundi", "kunji",
        "punda", "pundayandi", "sunniyandi", "sunni", "suni", "oombu", "umbu", "kotta", "pundamavan", "vesa", "vesaamavan", "vesamavan", "soothu", "pandi", "sinnavan", "motherfucker", "cunt", "naai", "fucker", "dick", "willy", "ass", "gotha", "gomma", "gommala", "ommala", "adangotha", "thevudiya"
      ],
      replies: [
        "Whoa, let's keep things friendly here! I'm still here to help, no hard feelings!",
        "I get it, emotions can run high sometimes. I'm here if you need me!",
        "Hey, no worries! We all have those moments. What can I help you with?",
        "It's all good! Let's just take a deep breath and move forward together.",
        "I know things can be frustrating, but I'm here to make it better if I can!"
      ]
    },
    {
      keywords: ["movie", "film", "recommend a movie", "what should I watch"],
      replies: ["How about a classic like 'The Shawshank Redemption'? It's a fantastic movie!", "If you like science fiction, 'Inception' is a great choice!", "For a fun animated film, you could watch 'Toy Story'!", "How about a Marvel movie? 'Guardians of the Galaxy' is a lot of fun!", "If you're in the mood for a romantic movie, 'The Notebook' is a popular pick!", "'Interstellar' is an amazing movie if you enjoy space and science fiction."]
    },
    {
      keywords: ["book", "recommend a book", "reading", "good book"],
      replies: ["Have you tried reading 'To Kill a Mockingbird'? It's a great classic!", "If you like fantasy, 'Harry Potter and the Philosopher's Stone' is a magical read!", "'1984' by George Orwell is a thought-provoking book you might enjoy!", "How about 'The Great Gatsby'? It's a fascinating story with rich characters!", "If you're into science fiction, 'Dune' by Frank Herbert is an epic read!", "'Pride and Prejudice' by Jane Austen is a classic romance novel that's loved by many."]
    },
    {
      keywords: ["travel", "where should I go", "vacation", "trip"],
      replies: ["How about visiting Japan? It's a beautiful country with a mix of tradition and modernity!", "Paris is always a good idea if you enjoy art, culture, and great food!", "If you like nature, a trip to New Zealand would be amazing!", "How about a relaxing beach vacation in the Maldives?", "For an adventure, consider visiting Iceland to see the Northern Lights!", "You could explore Italy for its rich history, culture, and delicious cuisine!"]
    },
    {
      keywords: ["food", "recipe", "what should I cook", "dinner ideas"],
      replies: ["How about making some pasta? It's quick, easy, and delicious!", "You could try making a stir-fry with your favorite vegetables and protein!", "How about cooking a classic like chicken curry? It's comforting and flavorful!", "If you're in the mood for something light, a fresh salad with your favorite toppings could be great!", "How about baking a pizza at home? You can customize it with all your favorite ingredients!", "You could make tacos for dinner—they're fun to assemble and tasty!"]
    },
    {
      keywords: ["exercise", "workout", "fitness", "stay healthy"],
      replies: ["How about starting with some light stretching? It's great for flexibility!", "A quick 20-minute cardio session can do wonders for your energy levels!", "Strength training is important for overall health—how about some bodyweight exercises?", "Yoga can be a fantastic way to relax and stay fit at the same time!", "How about a brisk walk or a jog? It's simple but effective!", "If you're short on time, try a high-intensity interval training (HIIT) workout!"]
    },
    {
      keywords: ["music", "song", "recommend a song", "what should I listen to"],
      replies: ["How about listening to 'Bohemian Rhapsody' by Queen? It's a classic!", "If you like pop music, 'Blinding Lights' by The Weeknd is really catchy!", "For something calming, you could listen to 'Clair de Lune' by Debussy.", "How about 'Hotel California' by Eagles? It's a great song!", "If you're in the mood for something upbeat, 'Can't Stop the Feeling!' by Justin Timberlake is fun!", "'Someone Like You' by Adele is a beautiful song if you're in a reflective mood."]
    },
    {
      keywords: ["sad", "feeling down", "depressed", "unhappy", "upset", "miserable", "gloomy"],
      replies: [
        "I'm sorry to hear that you're feeling sad. Remember that it's okay to feel this way, and things will get better.",
        "It's tough to feel sad. Is there anything specific that's bothering you? I'm here to listen.",
        "I'm here for you. Sometimes talking about what's making you sad can help. Would you like to share more?",
        "Feeling sad is a normal part of life, but that doesn't make it any easier. Is there something I can do to help cheer you up?",
        "I'm sorry you're feeling down. Remember that you're strong and capable of overcoming this. What usually helps you feel better?",
        "It's okay to not be okay sometimes. Your feelings are valid. Would you like to talk about what's causing your sadness?",
        "Sending you virtual support. Remember, this feeling is temporary and you have the strength to get through it."
      ]
    },
    {
      keywords: ["anxious", "worried", "stress", "overwhelmed"],
      replies: [
        "It sounds like you're feeling anxious. Remember to take deep breaths and focus on what you can control.",
        "Stress can be tough to handle. Have you tried any relaxation techniques?",
        "Being overwhelmed is a common feeling. Let's break down what's bothering you and tackle it step by step.",
        "Anxiety is challenging, but you're not alone. What specific concerns are on your mind right now?"
      ]
    },
    {
      keywords: ["happy", "excited", "joyful", "great news"],
      replies: [
        "That's wonderful to hear! I'm so happy for you. What's making you feel this way?",
        "It's great that you're feeling so positive! Would you like to share more about what's making you happy?",
        "Your happiness is contagious! I'd love to hear more about what's going well for you.",
        "That's fantastic news! Celebrations are in order. How do you plan to enjoy this moment?"
      ]
    },
    {
      keywords: ["confused", "don't understand", "unclear", "explain"],
      replies: [
        "I understand that this might be confusing. Which part would you like me to explain further?",
        "It's okay to feel confused sometimes. Let's break this down together. What specific aspect is unclear?",
        "I'll do my best to clarify. Could you tell me which part you're finding difficult to understand?",
        "Sometimes things can be complex. I'm here to help explain. What would you like me to focus on?"
      ]
    },
    {
      keywords: [["calculate"], ["compute"], ["solve"]],
      replies: [
        "I'd be happy to help you with some calculations! What would you like to compute?",
        "Sure, I can assist with math problems. What calculation do you need help with?",
        "Math is my forte! What would you like me to calculate for you?"
      ]
    },
    {
      keywords: [["feeling", "sad"], ["feeling", "depressed"], ["feeling", "down"]],
      replies: [
        "I'm sorry to hear you're feeling down. Remember, it's okay to feel this way sometimes. Is there anything specific you'd like to talk about?",
        "Feeling sad can be tough. Remember that you're not alone, and these feelings will pass. Would you like to share what's bothering you?",
        "I'm here for you. Sadness is a normal emotion, but if it's persistent, it might help to talk to someone. Can you tell me more about what's going on?"
      ]
    }
  ];

  const checkKeywords = (keywordSet, message) => {
    return keywordSet.every(keyword => message.toLowerCase().includes(keyword.toLowerCase()));
  };

  function getChatResponse(userMessage) {
    const mathModel = global.mathModel;
    if (mathModel && typeof mathModel.solveMathProblem === 'function') {
      const mathResult = mathModel.solveMathProblem(userMessage);
      if (mathResult !== null) {
        const formatted = mathModel.formatMathValue(mathResult);
        if (typeof formatted === 'string' && formatted.startsWith('Error')) {
          return formatted;
        }
        return `The result of the calculation is: ${formatted}`;
      }
    }

    for (let response of responses) {
      if (Array.isArray(response.keywords[0])) {
        if (response.keywords.some(keywordSet => checkKeywords(keywordSet, userMessage))) {
          return response.replies[Math.floor(Math.random() * response.replies.length)];
        }
      } else {
        if (response.keywords.some(keyword => userMessage.toLowerCase().includes(keyword.toLowerCase()))) {
          return response.replies[Math.floor(Math.random() * response.replies.length)];
        }
      }
    }

    return "I'm not sure how to respond to that, but I'm here to help if you have any questions or calculations!";
  }

  global.chatModel = {
    responses,
    checkKeywords,
    getChatResponse,
  };
})(typeof window !== 'undefined' ? window : globalThis);
