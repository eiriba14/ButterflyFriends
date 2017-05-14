﻿using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data.Entity;
using System.Data.Entity.Core;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Web;
using System.Web.Mvc;
using ButterflyFriends.Areas.Admin.Models.HRmanagementModels;
using ButterflyFriends.Models;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;
using Newtonsoft.Json;
using PagedList;

namespace ButterflyFriends.Controllers
{
    public class HomeController : Controller
    {
        ApplicationDbContext _context = new ApplicationDbContext();
        public int imageNum = 3;
        public int articleNum = 3;
        public ActionResult Index()
        {
            var articles = filterArticles(0, articleNum);
            var carousel = _context.Carousel.ToList();
            IList<CarouselObject> carouselList = new List<CarouselObject>();
            if (carousel.Any() && carousel.First().Enabeled)
            {
                foreach (var file in carousel.First().CarouselItems)
                {
                    if (file.FileType == DbTables.FileType.CarouselImage)
                    {
                        carouselList.Add(new CarouselObject { id = file.FileId, type = "image" });
                    }
                    else
                    {
                        carouselList.Add(new CarouselObject { id = file.FileId, type = "video" });

                    }
                }
            }
            else
            {
                carouselList = null;
            }
            
            var model = new FrontPageModel
            {
                Articles = articles,
                Carousel = carouselList
            };
            return View(model);

        }

        [HttpGet]
        public ActionResult Article(int? id)
        {
            if (id == null)
            {
                return new HttpStatusCodeResult(HttpStatusCode.BadRequest);
            }
            var article = _context.Articles.Find(id);
            if (article == null || !article.Published)
            {
                return HttpNotFound();
            }

            return View(article);
        }
        public ActionResult About()
        {
            ViewBag.Message = "Your application description page.";

            return View();
        }

        public ActionResult Contact()
        {
            ViewBag.Message = "Your contact page.";

            return View();
        }

        [HttpGet]
        public ActionResult RequestMembership()
        {
            ViewBag.Message = "Forespør Medlemskap.";
            
            var GoogleCaptcha = _context.GoogleCaptchaAPI.First();
            var model = new RequestModel
            {
                MembershipRequest = new DbTables.MembershipRequest(),
                SiteKey = GoogleCaptcha.SiteKey
            };
            var terms = (from s in _context.Files
                           where
                           s.FileType == DbTables.FileType.PDF
                           select s);
            if (terms.Any())
            {
                model.TermsID = terms.First().FileId;
            }
            return View(model);
        }

        [HttpPost]
        public ActionResult RequestMembership(RequestModel model)
        {
            
            if (ModelState.IsValid) {
                var encodedResponse = Request.Form["g-Recaptcha-Response"];
                var isCaptchaValid = ReCaptcha.Validate(encodedResponse);

                if (!isCaptchaValid)
                {
                    
                    ViewBag.Error = "Recaptcha feilet";
                    ViewBag.Reset = "false";
                    return PartialView("_statusPartial");
                }
                try
            {
                _context.MembershipRequests.Add(model.MembershipRequest);
                _context.SaveChanges();
                ViewBag.Success = "Din forespørsel ble suksessfult motatt, vi kontakter deg så snart vi kan";
                ViewBag.Reset = "true";
                return PartialView("_statusPartial");
            }
            catch (EntityException ex)
            {

                ViewBag.Error = "Noe gikk galt" + ex.Message;
                    ViewBag.Reset = "false";
                    return PartialView("_statusPartial");
            }
            }
            string messages = string.Join(" ", ModelState.Values
                                        .SelectMany(x => x.Errors)
                                        .Select(x => x.ErrorMessage));

            ViewBag.Error = "Ugyldige verdier: " + messages;
            ViewBag.Reset = "false";
            return PartialView("_statusPartial");

        }

        [Authorize(Roles = "Eier, Admin, Ansatt, Fadder")]
        public ActionResult MyImages()
        {
            var manager = new UserManager<ApplicationUser>(new UserStore<ApplicationUser>(new ApplicationDbContext()));
            ApplicationUser currentUser = manager.FindByIdAsync(User.Identity.GetUserId()).Result;
            if (currentUser == null)
            {
                return HttpNotFound();
            }
            var startId = 0;                                //id of first image i client
            var images = filterImages(currentUser, startId,imageNum);

            return View(new MyImagesModel
            {
                Images = images,
                StartId = 0
            });
        }

        public IList<DbTables.File> filterImages(ApplicationUser User,int startId, int imageNum)
        {
            List<DbTables.File> images = new List<DbTables.File>();
            IList<int> ids = new List<int>();
            if (User.Pictures.Any())
            {
                foreach (var picture in User.Pictures)
                {
                    if (picture.Published) { 
                    images.Add(picture);
                    ids.Add(picture.FileId);
                    }
                }
            }

            foreach (var child in User.Children)
            {
                foreach (var picture in child.Pictures)
                {
                    if (!ids.Contains(picture.FileId) && picture.Published)
                    {
                        images.Add(picture);
                        ids.Add(picture.FileId);
                    }
                }
            }
            images = images.OrderByDescending(s => s.UploadDate.Value).ThenByDescending(s => s.FileId).ToList();
            if (startId+imageNum <= images.Count)    //check if there's enough images to take from
            {
                images = images.GetRange(startId, imageNum);

            }
            else if (startId +1 > images.Count) //return nothing as startid is as great as there are elements in image list
            {
                images = null;
            }
            else if(imageNum >= images.Count)
            {
                //do nothing
            }
            else
            {
                images = images.GetRange(startId, images.Count -startId);
            }
            return images;
        }

        public IList<DbTables.Article> filterArticles(int startId, int articleNum)
        {
            var articles = _context.Articles.Where(s => s.Published).OrderByDescending(s => s.FirstPublisheDateTime).ThenByDescending(s => s.Id).ToList();
            if (startId + articleNum <= articles.Count)    //check if there's enough images to take from
            {
                articles = articles.GetRange(startId, articleNum);

            }
            else if (startId +1  > articles.Count) //return nothing as startid is as great as there are elements in image list
            {
                articles = null;
            }
            else if (articleNum >= articles.Count)  //return whole list as there are as many articles as there is articles on one page
            {
                //do nothing
            }
            else
            {
                articles = articles.GetRange(startId, articles.Count - startId);
            }
            return articles;
        }
        [HttpPost]
        public ActionResult GetImages()
        {
            var startId = int.Parse(Request.Form["startid"]);
            if(startId < imageNum) { 
            return null;
            }
            var manager = new UserManager<ApplicationUser>(new UserStore<ApplicationUser>(new ApplicationDbContext()));
            ApplicationUser currentUser = manager.FindByIdAsync(User.Identity.GetUserId()).Result;
            var images = filterImages(currentUser, startId, imageNum);

            return PartialView("_MyImagesPartial", new MyImagesModel {Images = images,StartId = startId});
        }

        [HttpPost]
        public ActionResult GetArticles()
        {
            var startId = int.Parse(Request.Form["startid"]);
            if (startId < articleNum)
            {
                return null;
            }
            
            var articles = filterArticles(startId, articleNum);

            return PartialView("_ArticlesPartial", articles);
        }
    }

    public class ReCaptcha
    {

        public bool Success { get; set; }
        public List<string> ErrorCodes { get; set; }
        
        public static bool Validate(string encodedResponse)
        {
            if (string.IsNullOrEmpty(encodedResponse)) return false;
            ApplicationDbContext _context = new ApplicationDbContext();
            var client = new System.Net.WebClient();
            var GoogleCaptchaList = _context.GoogleCaptchaAPI.ToList();
            var GoogleCaptcha = new DbTables.GoogleCaptchaAPI();
            if (GoogleCaptchaList.Any())
            {
                GoogleCaptcha = GoogleCaptchaList.First();
            }
            else
            {
                return false;
            }
            var secret = GoogleCaptcha.Secret;

            if (string.IsNullOrEmpty(secret)) return false;

            var googleReply = client.DownloadString(string.Format("https://www.google.com/recaptcha/api/siteverify?secret={0}&response={1}", secret, encodedResponse));

            var serializer = new System.Web.Script.Serialization.JavaScriptSerializer();

            var reCaptcha = serializer.Deserialize<ReCaptcha>(googleReply);

            return reCaptcha.Success;
        }
    }
}